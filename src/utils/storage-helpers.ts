import { Logger } from "../logger/logger";

export async function getLocalStorage(
  key: string,
  inSW: boolean = false,
): Promise<any> {
  return new Promise((resolve) => {
    if (inSW) {
      chrome.storage.local.get([key], function (result) {
        Logger.log("[getLocalStorage] => ", result);
        resolve(result[key]);
      });
    } else {
      chrome.runtime.sendMessage(
        {
          intent: "getLocalStorage",
          key: key,
        },
        function (response) {
          Logger.log("[getLocalStorage] => ", response);
          resolve(response);
        },
      );
    }
  });
}

export async function setLocalStorage(key: string, value: any): Promise<void> {
  return new Promise((resolve) => {
    chrome.storage.local.set({ [key]: value }, function () {
      Logger.log("[setLocalStorage] => ", { [key]: value });
      resolve();
    });
  });
}

export async function removeFromLocalStorage(key: string): Promise<void> {
  return new Promise((resolve) => {
    chrome.storage.local.remove([key], function () {
      Logger.log("[removeFromLocalStorage] => ", key);
      resolve();
    });
  });
}
