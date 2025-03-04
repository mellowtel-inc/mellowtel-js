import { WebsiteJar, CookieData } from "./expand-jar";
import { RULE_ID_START_BCREW } from "../constants";
import { Logger } from "../logger/logger";
import { isInSW } from "../utils/utils";
import { sendMessageToBackground } from "../utils/messaging-helpers";

export async function createJar(jarData: WebsiteJar): Promise<number[]> {
  return new Promise(async (resolve) => {
    if (!(await isInSW())) {
      Logger.log("[createJar] : Sending message to background");
      let response = await sendMessageToBackground({
        intent: "createJar",
        jarData: jarData,
      });
      resolve(response);
    } else {
      // Filter for HTTP Only cookies - but consider including all cookies that need to be set
      const httpOnlyCookies = jarData.cookies.filter(
        (cookie) => cookie.httpOnly,
      );

      const rules: chrome.declarativeNetRequest.Rule[] = httpOnlyCookies.map(
        (cookie, index) => {
          const ruleId = RULE_ID_START_BCREW + index;

          // Construct cookie string with exact same format as your working function
          let cookieStr = `${cookie.name}=${cookie.value}; Path=${cookie.path}; Domain=${cookie.domain}; Secure; HttpOnly; SameSite=None`;

          // Add expiration if not a session cookie
          if (!cookie.session && cookie.expirationDate) {
            const expirationDate = new Date(cookie.expirationDate * 1000);
            cookieStr += `; Expires=${expirationDate.toUTCString()}`;
          }

          return {
            id: ruleId,
            priority: 1,
            action: {
              type: chrome.declarativeNetRequest.RuleActionType.MODIFY_HEADERS,
              responseHeaders: [
                {
                  header: "Set-Cookie",
                  operation:
                    chrome.declarativeNetRequest.HeaderOperation.APPEND,
                  value: cookieStr,
                },
              ],
            },
            condition: {
              urlFilter: `||${jarData.domain}`,
              resourceTypes: ["sub_frame"], // Use string literal format, just like working function
            },
          } as chrome.declarativeNetRequest.Rule;
        },
      );

      // Get rule IDs for removal/tracking
      const ruleIds = rules.map((rule) => rule.id);

      // Output the rules for debugging
      Logger.log("Creating rules:", JSON.stringify(rules, null, 2));

      // Update dynamic rules
      chrome.declarativeNetRequest.updateDynamicRules(
        {
          removeRuleIds: ruleIds,
          addRules: rules,
        },
        () => {
          if (chrome.runtime.lastError) {
            Logger.error(
              "Error setting cookie rules:",
              chrome.runtime.lastError,
            );
            resolve([]);
          } else {
            Logger.log("Cookie rules successfully set");
            resolve(ruleIds);
          }
        },
      );
    }
  });
}

export function removeJarRules(ruleIds: number[]): void {
  chrome.declarativeNetRequest.updateDynamicRules(
    {
      removeRuleIds: ruleIds,
      addRules: [],
    },
    () => {
      if (chrome.runtime.lastError) {
        Logger.error("Error removing cookie rules:", chrome.runtime.lastError);
      } else {
        Logger.log("Cookie rules successfully removed");
      }
    },
  );
}
