export async function sendMessageToContentScript(
  tabId: number,
  message: any,
): Promise<any> {
  return new Promise((resolve) => {
    message.target = "contentScriptMellowtel";
    chrome.tabs.sendMessage(tabId, message, function (response) {
      resolve(response);
    });
  });
}

export async function sendMessageToBackground(message: any): Promise<any> {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage(message, (response) => {
      resolve(response);
    });
  });
}
