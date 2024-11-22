import HeaderOperation = chrome.declarativeNetRequest.HeaderOperation;
import RuleActionType = chrome.declarativeNetRequest.RuleActionType;
import ResourceType = chrome.declarativeNetRequest.ResourceType;
import Rule = chrome.declarativeNetRequest.Rule;
import { Logger } from "../logger/logger";
import {
  RULE_ID_CONTENT_DISPOSITION,
  RULE_ID_CONTENT_DISPOSITION_INLINE,
  RULE_ID_CONTENT_TYPE,
  RULE_ID_VALUE_TO_MODIFY_CONTENT_TYPE_TO,
} from "../constants";
import { shouldDelegateDNR } from "../dnr/dnr-helpers";
import { sendMessageToBackground } from "./messaging-helpers";
import { addToRequestInfoStorage } from "../request-info/request-info-helpers";

type MimeTypeMap = {
  [key: string]: string;
  pdf: string;
  json: string;
  xml: string;
  xlsx: string;
  xls: string;
  docx: string;
  doc: string;
  pptx: string;
  ppt: string;
  gif: string;
  jpg: string;
  jpeg: string;
  png: string;
  webp: string;
  svg: string;
  mp3: string;
  mp4: string;
  webm: string;
};

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

      // Add URL-specific condition to all rules
      const urlCondition = {
        resourceTypes: ["sub_frame" as ResourceType],
      };

      fetchAndProcessHeaders(url)
        .then(async function (result: {
          error: boolean;
          isPDF: boolean;
          isOfficeDoc: boolean;
          statusCode: number;
          removeContentDisposition?: boolean;
          modifyContentType?: boolean;
          valueToModifyContentTypeTo?: string;
        }) {
          Logger.log("@@ fetchAndProcessHeaders @@ =>", result);
          let isPDF: boolean = result.isPDF;
          let statusCode: number = result.statusCode;
          let isOfficeDoc: boolean = result.isOfficeDoc;

          // Store request info
          await addToRequestInfoStorage({
            recordID: recordID,
            isPDF: isPDF,
            isOfficeDoc: isOfficeDoc,
            statusCode: statusCode,
          });

          if (result.error) {
            res("error");
          } else if (isOfficeDoc) {
            res("done");
          } else {
            // Handle content-disposition removal
            if (result.removeContentDisposition) {
              rulesToApply.push({
                id: RULE_ID_CONTENT_DISPOSITION,
                priority: 1, // Increased priority
                action: {
                  type: "modifyHeaders" as RuleActionType,
                  responseHeaders: [
                    {
                      header: "content-disposition",
                      operation: "remove" as HeaderOperation,
                    },
                  ],
                },
                condition: urlCondition,
              });
            }

            // Content type modification
            if (result.modifyContentType && result.valueToModifyContentTypeTo) {
              // First remove existing content-type
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
                condition: urlCondition,
              });

              // Then set new content-type
              rulesToApply.push({
                id: RULE_ID_VALUE_TO_MODIFY_CONTENT_TYPE_TO,
                priority: 1, // Highest priority to ensure it's applied last
                action: {
                  type: "modifyHeaders" as RuleActionType,
                  responseHeaders: [
                    {
                      header: "content-type",
                      operation: "set" as HeaderOperation,
                      value: result.valueToModifyContentTypeTo,
                    },
                    // Add additional headers to prevent download
                    {
                      header: "x-content-type-options",
                      operation: "set" as HeaderOperation,
                      value: "nosniff",
                    },
                  ],
                },
                condition: urlCondition,
              });

              // For Office documents and PDFs, add extra protection
              if (isPDF || isOfficeDoc) {
                rulesToApply.push({
                  id: RULE_ID_CONTENT_DISPOSITION_INLINE,
                  priority: 2, // Higher priority than removal
                  action: {
                    type: "modifyHeaders" as RuleActionType,
                    responseHeaders: [
                      {
                        header: "content-disposition",
                        operation: "set" as HeaderOperation,
                        value: "inline",
                      },
                      {
                        header: "x-content-type-options",
                        operation: "set" as HeaderOperation,
                        value: "nosniff",
                      },
                    ],
                  },
                  condition: urlCondition,
                });
              }
            }

            // Update session rules
            try {
              await chrome.declarativeNetRequest.updateSessionRules({
                removeRuleIds: [
                  RULE_ID_CONTENT_DISPOSITION,
                  RULE_ID_CONTENT_TYPE,
                  RULE_ID_VALUE_TO_MODIFY_CONTENT_TYPE_TO,
                  RULE_ID_CONTENT_DISPOSITION_INLINE,
                ],
                addRules: rulesToApply,
              });
              Logger.log("Updated session rules successfully:", rulesToApply);
              res("done");
            } catch (error) {
              Logger.error("Failed to update session rules:", error);
              res("error");
            }
          }
        })
        .catch((error) => {
          Logger.error("Fetch error:", error);
          res("error");
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
            RULE_ID_CONTENT_DISPOSITION_INLINE,
          ],
        });
        res("done");
      }
    });
  });
}

async function fetchAndProcessHeaders(url: string) {
  let response = new Response();
  try {
    Logger.log("[fetchAndProcessHeaders] => Fetching URL:", url);
    response = await fetch(url);
  } catch (error) {
    Logger.log("[fetchAndProcessHeaders] => Fetch error:", error);
    return { error: true, isPDF: false, isOfficeDoc: false, statusCode: 599 };
  }
  try {
    const statusCode = response.status;
    const contentType: string | undefined = response.headers
      .get("content-type")
      ?.toLowerCase();
    Logger.log("Content-Type:", contentType);

    const isPDF = contentType === "application/pdf";
    const isOfficeDoc = isOfficeDocument(contentType);
    Logger.log("isPDF:", isPDF, "isOfficeDoc:", isOfficeDoc);

    const removeContentDisposition = false; // TODO: WHAT SHOULD DEFAULT BE?
    let modifyContentType = false;
    let valueToModifyContentTypeTo = "";

    const contentDisposition = response.headers.get("content-disposition");
    Logger.log("## Content-Disposition:", contentDisposition);

    // Process content type for Office documents
    if (contentType) {
      const fileType = url.substring(url.lastIndexOf(".") + 1).toLowerCase();
      Logger.log("Detected file type:", fileType);

      // Skip binary and archive files
      const skipTypes = [
        "exe",
        "dmg",
        "deb",
        "rpm",
        "apk",
        "msi",
        "pkg",
        "zip",
        "rar",
        "7z",
        "gz",
        "tar",
        "xz",
        "bz2",
      ];

      if (!skipTypes.includes(fileType) && isOfficeDoc) {
        modifyContentType = true;

        // For Office documents, always force inline viewing
        const mimeTypeMap = {
          xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
          doc: "application/msword",
          ppt: "application/vnd.ms-powerpoint",
          xls: "application/vnd.ms-excel",
        };

        valueToModifyContentTypeTo = Object.prototype.hasOwnProperty.call(
          mimeTypeMap,
          fileType,
        )
          ? (mimeTypeMap as Record<string, string>)[fileType]
          : contentType;
      }
    }

    return {
      error: false,
      isPDF: isPDF,
      isOfficeDoc: isOfficeDoc,
      statusCode: statusCode,
      removeContentDisposition: removeContentDisposition,
      modifyContentType: modifyContentType,
      valueToModifyContentTypeTo: valueToModifyContentTypeTo,
    };
  } catch (error) {
    Logger.error("Fetch error:", error);
    return { error: true, isPDF: false, isOfficeDoc: false, statusCode: 599 };
  }
}

// Helper function to detect Office documents
function isOfficeDocument(contentType: string | undefined): boolean {
  if (!contentType) return false;

  const officeTypes = [
    "application/vnd.openxmlformats-officedocument.",
    "application/vnd.ms-",
    "application/msword",
    "application/vnd.oasis.opendocument.",
  ];

  return officeTypes.some((type) => contentType.includes(type));
}
