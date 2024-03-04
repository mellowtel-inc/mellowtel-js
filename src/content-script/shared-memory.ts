import {
  sendMessageToBackground,
  sendMessageToContentScript,
} from "../utils/messaging-helpers";

export function setSharedMemory(key: string, value: any): void {
  let hiddenInput: HTMLInputElement = document.createElement("input");
  hiddenInput.setAttribute("type", "hidden");
  hiddenInput.setAttribute("id", key);
  hiddenInput.setAttribute("value", value);
  document.body.appendChild(hiddenInput);
  sendMessageToBackground({
    intent: "setSharedMemoryBCK",
    key: key,
    value: value,
  }).then();
}

export function getSharedMemory(key: string): Promise<any> {
  return new Promise((resolve) => {
    // send message to background.js, that will then broadcast it to all tabs
    sendMessageToBackground({
      intent: "getSharedMemoryBCK",
      key: key,
    }).then(function (response) {
      resolve(response);
    });
  });
}

export function getSharedMemoryDOM(key: string) {
  return new Promise((resolve) => {
    let hiddenInput: HTMLElement | null = document.getElementById(key);
    if (hiddenInput) {
      resolve(true);
    } else {
      resolve(false);
    }
  });
}

export function removeSharedMemory(key: string): void {
  let hiddenInput: HTMLElement | null = document.getElementById(key);
  if (hiddenInput) hiddenInput.remove();
}

export async function setSharedMemoryBCK(key: string, tabId: number) {
  return new Promise(function (res) {
    chrome.storage.local.set({ [key]: tabId }, function () {
      res("done");
    });
  });
}

export async function getSharedMemoryBCK(key: string) {
  return new Promise(function (res) {
    chrome.tabs.query({}, function (tabs) {
      let numTabs: number = tabs.length;
      let numTabsChecked: number = 0;
      let mllwtlFramePresent: boolean = false;
      for (let i = 0; i < numTabs; i++) {
        sendMessageToContentScript(tabs[i].id!, {
          intent: "getSharedMemoryDOM",
          key: key,
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
