import { Logger } from "../logger/logger";

export function shouldDelegateTabsAPI(): Promise<boolean> {
  return new Promise((resolve) => {
    try {
      chrome.tabs.query({}, function (tabs) {
        if (chrome.runtime.lastError) {
          resolve(true);
        } else {
          resolve(false);
        }
      });
    } catch (error) {
      Logger.error("Error in shouldDelegateTabsApi", error);
      resolve(true);
    }
  });
}
