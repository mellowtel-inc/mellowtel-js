import { Logger } from "../logger/logger";

export async function sendMessageToContentScript(
  tabId: number,
  message: any,
): Promise<any> {
  return new Promise((resolve) => {
    message.target = "contentScriptM";
    try {
      chrome.tabs.sendMessage(tabId, message, function (response) {
        if (chrome.runtime.lastError) {
          Logger.log(
            "[sendMessageToContentScript] => Error:",
            chrome.runtime.lastError,
          );
          resolve(null);
        }
        resolve(response);
      });
    } catch (e) {
      Logger.log("[sendMessageToContentScript] => Error:", e);
      resolve(null);
    }
  });
}

export async function sendMessageToBackground(message: any): Promise<any> {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage(message, (response) => {
      resolve(response);
    });
  });
}
