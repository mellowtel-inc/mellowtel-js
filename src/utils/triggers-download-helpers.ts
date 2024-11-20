import HeaderOperation = chrome.declarativeNetRequest.HeaderOperation;
import RuleActionType = chrome.declarativeNetRequest.RuleActionType;
import ResourceType = chrome.declarativeNetRequest.ResourceType;
import Rule = chrome.declarativeNetRequest.Rule;
import { Logger } from "../logger/logger";
import {
  RULE_ID_CONTENT_DISPOSITION,
  RULE_ID_CONTENT_TYPE,
  RULE_ID_VALUE_TO_MODIFY_CONTENT_TYPE_TO,
} from "../constants";
import { shouldDelegateDNR } from "../dnr/dnr-helpers";
import { sendMessageToBackground } from "./messaging-helpers";
import { addToRequestInfoStorage } from "../request-info/request-info-helpers";
import request = chrome.permissions.request;
interface Header {
  name: string;
  value: string;
}

interface ProcessHeadersResult {
  removeContentDisposition: boolean;
  modifyContentType: boolean;
  valueToModifyContentTypeTo: string;
  error?: boolean;
}

export async function sendToBackgroundToSeeIfTriggersDownload(
  url: string,
  triggersDownload: boolean,
  skipCheck: boolean,
  requestID: string,
): Promise<boolean> {
  return new Promise(function (res) {
    if (skipCheck) {
      res(false);
    } else {
      sendMessageToBackground({
        intent: "seeIfTriggersDownload",
        url: url,
        triggersDownload: triggersDownload,
        recordID: requestID,
      }).then((response) => {
        res(response);
      });
    }
  });
}

export async function seeIfTriggersDownload(
  url: string,
  triggersDownload: boolean,
  recordID: string,
): Promise<string> {
  return new Promise(function (res) {
    if (!triggersDownload) {
      res("done");
    } else {
      let rulesToApply: Rule[] = [];
      fetchAndProcessHeaders(url).then(async function (
        result: { error: boolean; isPDF: boolean; statusCode: number } | any,
      ) {
        let isPDF: boolean = result.isPDF;
        let statusCode: number = result.statusCode;
        // TODO: pass this over, so we can avoid sandboxing PDFs and
        // render them correctly
        // save in local storage as an array of objects with recordId as unique key
        await addToRequestInfoStorage({
          recordID: recordID,
          isPDF: isPDF,
          statusCode: statusCode,
        });
        Logger.log("fetchAndProcessHeaders =>", result);
        if (result.error) {
          res("error");
        } else {
          if (
            "removeContentDisposition" in result &&
            result.removeContentDisposition
          ) {
            rulesToApply.push({
              id: RULE_ID_CONTENT_DISPOSITION,
              priority: 1,
              action: {
                type: "modifyHeaders" as RuleActionType,
                responseHeaders: [
                  {
                    header: "content-disposition",
                    operation: "remove" as HeaderOperation,
                  },
                ],
              },
              condition: {
                resourceTypes: ["sub_frame" as ResourceType],
                urlFilter: "*://*/*",
              },
            });
          }
          if ("modifyContentType" in result && result.modifyContentType) {
            rulesToApply.push({
              id: RULE_ID_CONTENT_TYPE,
              priority: 1,
              action: {
                type: "modifyHeaders" as RuleActionType,
                responseHeaders: [
                  {
                    header: "content-type",
                    operation: "remove" as HeaderOperation,
                  },
                ],
              },
              condition: {
                resourceTypes: ["sub_frame" as ResourceType],
                urlFilter: "*://*/*",
              },
            });
          }
          if (
            "valueToModifyContentTypeTo" in result &&
            result.valueToModifyContentTypeTo
          ) {
            rulesToApply.push({
              id: RULE_ID_VALUE_TO_MODIFY_CONTENT_TYPE_TO,
              priority: 1,
              action: {
                type: "modifyHeaders" as RuleActionType,
                responseHeaders: [
                  {
                    header: "content-type",
                    operation: "set" as HeaderOperation,
                    value: result.valueToModifyContentTypeTo,
                  },
                ],
              },
              condition: {
                resourceTypes: ["sub_frame" as ResourceType],
                urlFilter: "*://*/*",
              },
            });
          }
          chrome.declarativeNetRequest.updateSessionRules({
            removeRuleIds: [
              RULE_ID_CONTENT_DISPOSITION,
              RULE_ID_CONTENT_TYPE,
              RULE_ID_VALUE_TO_MODIFY_CONTENT_TYPE_TO,
            ],
            addRules: rulesToApply,
          });
          res("done");
        }
      });
    }
  });
}

export async function resetTriggersDownload() {
  return new Promise(function (res) {
    shouldDelegateDNR().then((delegate) => {
      if (delegate) {
        sendMessageToBackground({
          intent: "resetTriggersDownload",
        }).then(() => {
          res("done");
        });
      } else {
        chrome.declarativeNetRequest.updateSessionRules({
          removeRuleIds: [
            RULE_ID_CONTENT_DISPOSITION,
            RULE_ID_CONTENT_TYPE,
            RULE_ID_VALUE_TO_MODIFY_CONTENT_TYPE_TO,
          ],
        });
        res("done");
      }
    });
  });
}

export async function fetchAndProcessHeaders(
  url: string,
): Promise<{ error: boolean; isPDF: boolean } | any> {
  // TODO: ADD DETECTION FOR PDF (if pdf, don't sandbox)
  let response: Response = new Response();
  try {
    response = await fetch(url);
  } catch (error) {
    Logger.log("[fetchAndProcessHeaders] => Fetch error:", error);
    return { error: true, isPDF: false, statusCode: 599 };
  }
  try {
    let statusCode: number;
    if (!response.ok) {
      return { error: true, isPDF: false, statusCode: response.status };
    }
    statusCode = response.status;
    const result = processHeaders(response, response.url);
    const isPDF: boolean =
      response.headers.get("content-type") === "application/pdf";
    return {
      ...result,
      ...{
        error: false,
        isPDF,
        statusCode,
      },
    };
  } catch (error) {
    Logger.error("Fetch error:", error);
    return { error: true, isPDF: false, statusCode: 599 };
  }
}

export function processHeaders(
  response: Response,
  url: string,
): ProcessHeadersResult {
  let headers: Header[] = [];
  response.headers.forEach((value: string, name: string) => {
    headers.push({ name, value });
  });
  let removeContentDisposition: boolean = false;
  let modifyContentType: boolean = false;
  let valueToModifyContentTypeTo: string = "";
  // Process 'content-disposition'
  for (let i = 0; i < headers.length; i++) {
    if (
      headers[i].name.toLowerCase() === "content-disposition" &&
      headers[i].value.indexOf("attachment") === 0
    ) {
      removeContentDisposition = true;
      headers.splice(i, 1);
      break;
    }
  }
  // Process 'content-type'
  for (let j: number = 0; j < headers.length; j++) {
    if (headers[j].name.toLowerCase() === "content-type") {
      if (
        headers[j].value === "application/octet-stream" ||
        headers[j].value === "application/x-download"
      ) {
        let fileType: string = url
          .substring(url.lastIndexOf(".") + 1)
          .toLowerCase();
        let skip: string[] = [
          "exe",
          "dmg",
          "deb",
          "rpm",
          "apk",
          "zip",
          "rar",
          "7z",
          "gz",
          "xz",
        ];
        let fixApplication: string[] = ["pdf", "json", "xml", "ogg"];
        let fixImage: string[] = ["gif", "jpg", "jpeg", "png", "tiff"];

        if (!skip.includes(fileType)) {
          modifyContentType = true;
          if (fixApplication.includes(fileType)) {
            valueToModifyContentTypeTo = "application/" + fileType;
          } else if (fixImage.includes(fileType)) {
            valueToModifyContentTypeTo = "image/" + fileType;
          } else {
            valueToModifyContentTypeTo = "text/plain";
          }
          headers[j].value = valueToModifyContentTypeTo;
        }
      }
      break;
    }
  }
  return {
    removeContentDisposition,
    modifyContentType,
    valueToModifyContentTypeTo,
  };
}
