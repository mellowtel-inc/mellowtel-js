import { setLocalStorage } from "./storage-helpers";

const optInKey: string = "mellowtelOptIn";

export async function getOptInStatus(): Promise<boolean> {
  return new Promise((resolve) => {
    chrome.storage.local.get(optInKey, function (result) {
      if (result !== undefined && result[optInKey] === "true") {
        resolve(true);
      } else {
        resolve(false);
      }
    });
  });
}

export async function optIn(): Promise<boolean> {
  return new Promise((resolve) => {
    setLocalStorage(optInKey, "true").then(() => {
      resolve(true);
    });
  });
}

export async function optOut(): Promise<boolean> {
  return new Promise((resolve) => {
    setLocalStorage(optInKey, "false").then(() => {
      setLocalStorage("mStatus", "stop").then(() => {
        resolve(true);
      });
    });
  });
}
