export async function sendMessageToContentScript(
  tabId: number,
  message: any,
): Promise<any> {
  return new Promise((resolve) => {
    message.target = "contentScriptM";
    try {
      chrome.tabs.sendMessage(tabId, message, function (response) {
        if (chrome.runtime.lastError) {
          resolve(null);
        }
        resolve(response);
      });
    } catch (e) {
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
