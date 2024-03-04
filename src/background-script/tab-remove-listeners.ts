import { sendMessageToContentScript } from "../utils/messaging-helpers";

export async function setUpOnTabRemoveListeners(): Promise<void> {
  chrome.tabs.onRemoved.addListener(function (
    tabId: number,
    removeInfo: chrome.tabs.TabRemoveInfo,
  ) {
    chrome.storage.local.get(
      ["webSocketConnectedMellowtel"],
      function (result: { [key: string]: any }) {
        let webSocketConnected = result["webSocketConnectedMellowtel"];
        if (webSocketConnected === tabId) {
          let sentMessage: boolean = false;
          chrome.tabs.query({}, function (tabs: chrome.tabs.Tab[]): void {
            while (!sentMessage) {
              for (let i: number = 0; i < tabs.length; i++) {
                if (!tabs[i]?.url?.includes("chrome://")) {
                  sendMessageToContentScript(tabs[i].id!, {
                    intent: "startConnectionMellowtel",
                  }).then(function (): void {
                    sentMessage = true;
                  });
                }
              }
            }
          });
        }
      },
    );
  });
}
