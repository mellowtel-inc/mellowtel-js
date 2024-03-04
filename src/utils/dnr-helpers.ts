import HeaderOperation = chrome.declarativeNetRequest.HeaderOperation;
import RuleActionType = chrome.declarativeNetRequest.RuleActionType;
import ResourceType = chrome.declarativeNetRequest.ResourceType;
import { sendMessageToBackground } from "./messaging-helpers";
import { RULE_ID_XFRAME } from "../constants";

export function disableXFrameHeaders(
  hostname: string,
  skipHeaders: boolean,
): Promise<boolean> {
  return new Promise(function (res) {
    if (skipHeaders) {
      res(false);
    } else {
      let ruleId = getRuleIdFromHostname(hostname);
      shouldDelegateDNR().then((delegate) => {
        if (delegate) {
          sendMessageToBackground({
            intent: "disableXFrameHeaders",
            hostname: hostname,
            skipHeaders: skipHeaders,
          }).then(() => {
            res(true);
          });
        } else {
          chrome.declarativeNetRequest.updateSessionRules({
            removeRuleIds: [ruleId],
            addRules: [
              {
                id: ruleId,
                priority: 1,
                action: {
                  type: "modifyHeaders" as RuleActionType,
                  responseHeaders: [
                    {
                      header: "x-frame-options",
                      operation: "remove" as HeaderOperation,
                    },
                    {
                      header: "content-security-policy",
                      operation: "remove" as HeaderOperation,
                    },
                    {
                      header: "X-Frame-Options",
                      operation: "remove" as HeaderOperation,
                    },
                    {
                      header: "Content-Security-Policy",
                      operation: "remove" as HeaderOperation,
                    },
                    {
                      header: "Frame-Options",
                      operation: "remove" as HeaderOperation,
                    },
                  ],
                },
                condition: {
                  resourceTypes: ["sub_frame" as ResourceType],
                  urlFilter: "*://*/*",
                  // `*${hostname}*`, --> specific filter disabled because
                  // there are internal redirects that need to be handled.
                  // Need to find a way to handle redirects and disable headers
                  // for all of them (while leaving them on for other sites).
                },
              },
            ],
          });
          res(true);
        }
      });
    }
  });
}

export function enableXFrameHeaders(hostname: string): Promise<boolean> {
  return new Promise(function (res) {
    let ruleId = getRuleIdFromHostname(hostname);
    shouldDelegateDNR().then((delegate) => {
      if (delegate) {
        sendMessageToBackground({
          intent: "enableXFrameHeaders",
          hostname: hostname,
        }).then(() => {
          res(true);
        });
      } else {
        chrome.declarativeNetRequest.updateSessionRules({
          removeRuleIds: [ruleId],
        });
        res(true);
      }
    });
  });
}

export function getRuleIdFromHostname(hostname: string): number {
  // Disabled because a hostname can redirect to another hostname.
  // We need to disable the headers for the redirected hostname too.
  // TODO: Find a way to "map out" the redirects and disable the headers for all of them.
  /*
  let hashNumber = 0;
  for (let i = 0; i < hostname.length; i++) {
    hashNumber += hostname.charCodeAt(i);
  }
  return hashNumber;
  */
  return RULE_ID_XFRAME;
}

export function shouldDelegateDNR(): Promise<boolean> {
  return new Promise((resolve) => {
    try {
      chrome.declarativeNetRequest.getDynamicRules((rules) => {
        if (chrome.runtime.lastError) {
          resolve(true);
        } else {
          resolve(false);
        }
      });
    } catch (error) {
      resolve(true);
    }
  });
}
