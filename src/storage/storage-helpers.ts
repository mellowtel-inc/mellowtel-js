export function getLocalStorage(
  key: string,
  extract_key = false,
): Promise<any> {
  return new Promise((resolve) => {
    chrome.storage.local.get(key, function (result) {
      if (extract_key) {
        resolve(result[key]);
      } else {
        resolve(result);
      }
    });
  });
}

export function setLocalStorage(key: string, value: any): Promise<boolean> {
  return new Promise((resolve) => {
    chrome.storage.local.set({ [key]: value }, function () {
      resolve(true);
    });
  });
}

export function deleteLocalStorage(keys: string[]): Promise<boolean> {
  return new Promise((resolve) => {
    chrome.storage.local.remove(keys, function () {
      resolve(true);
    });
  });
}
