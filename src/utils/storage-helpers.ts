import { sendMessageToBackground } from "./messaging-helpers";

export function getLocalStorage(key: string, extract_key = false): Promise<any> {
  return new Promise((resolve) => {
    shouldDelegateStorage().then((delegate) => {
      if (delegate) {
        sendMessageToBackground({ intent: "getLocalStorage", key: key }).then(
          (response) => {
            resolve(response);
          },
        );
      } else {
        chrome.storage.local.get(key, function (result) {
          if(extract_key) {
            resolve(result[key]);
          } else {
            resolve(result);
          }
        });
      }
    });
  });
}

export function setLocalStorage(key: string, value: any): Promise<boolean> {
  return new Promise((resolve) => {
    shouldDelegateStorage().then((delegate) => {
      if (delegate) {
        sendMessageToBackground({
          intent: "setLocalStorage",
          key: key,
          value: value,
        }).then((response) => {
          resolve(response);
        });
      } else {
        chrome.storage.local.set({ [key]: value }, function () {
          resolve(true);
        });
      }
    });
  });
}

export function deleteLocalStorage(keys: string[]): Promise<boolean> {
  return new Promise((resolve) => {
    shouldDelegateStorage().then((delegate) => {
      if (delegate) {
        sendMessageToBackground({
          intent: "deleteLocalStorage",
          keys: JSON.stringify(keys),
        }).then((response) => {
          resolve(response);
        });
      } else {
        chrome.storage.local.remove(keys, function () {
          resolve(true);
        });
      }
    });
  });
}

export function shouldDelegateStorage(): Promise<boolean> {
  return new Promise((resolve) => {
    try {
      chrome.storage.local.get(null, () => {
        if (chrome.runtime.lastError) {
          resolve(true);
        } else {
          resolve(false);
        }
      });
    } catch (error) {
      resolve(true);
    }
  });
}
