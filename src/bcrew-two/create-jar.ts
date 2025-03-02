import { WebsiteJar, CookieData } from "./expand-jar";
import { RULE_ID_START_BCREW } from "../constants";

export function createJar(jarData: WebsiteJar): number[] {
  const httpOnlyCookies = jarData.cookies.filter((cookie) => cookie.httpOnly);

  const rules: chrome.declarativeNetRequest.Rule[] = httpOnlyCookies.map(
    (cookie, index) => {
      const ruleId = RULE_ID_START_BCREW + index;

      let cookieStr = `${cookie.name}=${cookie.value}; Path=${cookie.path}; Domain=${cookie.domain}`;

      if (cookie.secure) cookieStr += "; Secure";
      if (cookie.httpOnly) cookieStr += "; HttpOnly";

      // Handle SameSite attribute
      if (cookie.sameSite && cookie.sameSite !== "unspecified") {
        // cookieStr += `; SameSite=${cookie.sameSite}`;
        cookieStr += "; SameSite=None";
      } else {
        cookieStr += "; SameSite=None";
      }

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
              operation: chrome.declarativeNetRequest.HeaderOperation.APPEND,
              value: cookieStr,
            },
          ],
        },
        condition: {
          urlFilter: `||${jarData.domain}`,
          resourceTypes: [chrome.declarativeNetRequest.ResourceType.SUB_FRAME],
        },
      } as chrome.declarativeNetRequest.Rule;
    },
  );

  // Get rule IDs for removal/tracking
  const ruleIds = rules.map((rule) => rule.id);

  // Update dynamic rules
  chrome.declarativeNetRequest.updateDynamicRules(
    {
      removeRuleIds: ruleIds, // Remove existing rules with these IDs if they exist
      addRules: rules,
    },
    () => {
      if (chrome.runtime.lastError) {
        console.error("Error setting cookie rules:", chrome.runtime.lastError);
      } else {
        console.log("Cookie rules successfully set");
      }
    },
  );

  return ruleIds;
}

export function removeJarRules(ruleIds: number[]): void {
  chrome.declarativeNetRequest.updateDynamicRules(
    {
      removeRuleIds: ruleIds,
      addRules: [],
    },
    () => {
      if (chrome.runtime.lastError) {
        console.error("Error removing cookie rules:", chrome.runtime.lastError);
      } else {
        console.log("Cookie rules successfully removed");
      }
    },
  );
}
