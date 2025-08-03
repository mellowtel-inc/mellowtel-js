import HeaderOperation = chrome.declarativeNetRequest.HeaderOperation;
import RuleActionType = chrome.declarativeNetRequest.RuleActionType;
import ResourceType = chrome.declarativeNetRequest.ResourceType;
import { sendMessageToBackground } from "../utils/messaging-helpers";
import {
  RULE_ID_POST_REQUEST,
  RULE_ID_XFRAME,
} from "../constants";
import { isInSW } from "../utils/utils";


export function disableHeadersForPOST(): Promise<boolean> {
  return new Promise(function (res) {
    chrome.declarativeNetRequest.updateSessionRules({
      removeRuleIds: [RULE_ID_POST_REQUEST],
      addRules: [
        {
          id: RULE_ID_POST_REQUEST,
          priority: 1,
          action: {
            type: "modifyHeaders" as RuleActionType,
            requestHeaders: [
              {
                header: "Origin",
                operation: "remove" as HeaderOperation,
              },
            ],
            responseHeaders: [
              {
                header: "Access-Control-Allow-Origin",
                operation: "set" as HeaderOperation,
                value: "*",
              },
              {
                header: "Access-Control-Allow-Methods",
                operation: "set" as HeaderOperation,
                value: "GET, POST, PUT, DELETE, OPTIONS",
              },
              {
                header: "Access-Control-Allow-Headers",
                operation: "set" as HeaderOperation,
                value: "Content-Type",
              },
            ],
          },
          condition: {
            urlFilter: "*://*/*",
            resourceTypes: ["xmlhttprequest" as ResourceType],
          },
        },
      ],
    });
    res(true);
  });
}

export function enableHeadersForPOST(): Promise<boolean> {
  return new Promise(function (res) {
    chrome.declarativeNetRequest.updateSessionRules({
      removeRuleIds: [RULE_ID_POST_REQUEST],
    });
    res(true);
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
      chrome.declarativeNetRequest.getSessionRules((rules) => {
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

export async function cleaunUpRules() {
  const RULES_TO_REMOVE = [RULE_ID_POST_REQUEST];

  const isInServiceWorker = await isInSW();

  if (!isInServiceWorker) {
    await sendMessageToBackground({
      intent: "cleanUpDNRRules",
    });
  } else {
    await chrome.declarativeNetRequest.updateSessionRules({
      removeRuleIds: RULES_TO_REMOVE,
    });
  }
}
