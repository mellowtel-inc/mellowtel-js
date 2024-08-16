import { sendMessageToContentScript } from "../utils/messaging-helpers";
import { getLocalStorage, setLocalStorage } from "../utils/storage-helpers";
import { start } from "../utils/start-stop-helpers";
import { getOptInStatus, optIn } from "../utils/opt-in-out-helpers";
import { Logger } from "../logger/logger";

export async function setUpOnTabRemoveListeners(): Promise<void> {
  chrome.tabs.onRemoved.addListener(async function (
    tabId: number,
    removeInfo: chrome.tabs.TabRemoveInfo,
  ) {
    chrome.storage.local.get(
      ["webSocketConnected"],
      function (result: { [key: string]: any }) {
        let webSocketConnected = result["webSocketConnected"];
        if (webSocketConnected === tabId) {
          let sentMessage: boolean = false;
          chrome.tabs.query({}, async function (tabs: chrome.tabs.Tab[]) {
            for (let i: number = 0; i < tabs.length; i++) {
              if (!tabs[i]?.url?.includes("chrome://") && !sentMessage) {
                await sendMessageToContentScript(tabs[i].id!, {
                  intent: "startConnectionM",
                }).then(function (): void {
                  sentMessage = true;
                });
              }
            }
          });
        }
      },
    );
  });
}
