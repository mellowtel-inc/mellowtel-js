import { sendMessageToContentScript } from "../utils/messaging-helpers";
import { DATA_ID_STRING } from "../constants";

export async function getIfCurrentlyActiveBCK() {
  return new Promise(function (res) {
    chrome.tabs.query({}, function (tabs) {
      let numTabs: number = tabs.length;
      let numTabsChecked: number = 0;
      let mllwtlFramePresent: boolean = false;
      for (let i = 0; i < numTabs; i++) {
        sendMessageToContentScript(tabs[i].id!, {
          intent: "getSharedMemoryDOM",
        }).then(function (response): void {
          numTabsChecked++;
          if (response) {
            mllwtlFramePresent = true;
          }
          if (numTabsChecked === numTabs) {
            res(mllwtlFramePresent);
          }
        });
      }
    });
  });
}

export function getIfCurrentlyActiveDOM() {
  return new Promise((resolve) => {
    let frame: HTMLIFrameElement | null = document.querySelector(
      `[id^=${DATA_ID_STRING}]`,
    );
    if (frame) {
      resolve(true);
    } else {
      resolve(false);
    }
  });
}
