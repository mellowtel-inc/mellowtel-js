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
import { shouldDelegateDNR } from "./dnr-helpers";
import { sendMessageToBackground } from "./messaging-helpers";
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
): Promise<boolean> {
  return new Promise(function (res) {
      sendMessageToBackground({
        intent: "seeIfTriggersDownload",
        url: url,
        triggersDownload: triggersDownload,
      }).then((response) => {
        res(response);
      });
  });
}

export async function seeIfTriggersDownload(
  url: string,
  triggersDownload: boolean,
): Promise<string> {
  return new Promise(function (res) {
    if (!triggersDownload) {
      res("done");
    } else {
      let rulesToApply: Rule[] = [];
      fetchAndProcessHeaders(url).then(function (
        result: { error: boolean } | ProcessHeadersResult,
      ) {
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
              priority: 2,
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
              priority: 2,
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
              priority: 2,
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
export function fetchAndProcessHeaders(
  url: string,
): Promise<{ error: boolean } | ProcessHeadersResult> {
  return fetch(url)
    .then((response) => {
      if (!response.ok) {
        return { error: true };
      }
      const result = processHeaders(response, response.url);
      return {
        ...result,
        ...{
          error: false,
        },
      };
    })
    .catch((error) => {
      Logger.error("Fetch error:", error);
      return { error: true };
    });
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
