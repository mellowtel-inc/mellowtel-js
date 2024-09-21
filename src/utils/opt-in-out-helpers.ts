import { setLocalStorage } from "../storage/storage-helpers";

const optInKey: string = "mellowtelOptIn";

export async function getOptInStatus(): Promise<{
  status: string;
  boolean: boolean;
}> {
  return new Promise((resolve) => {
    chrome.storage.local.get(optInKey, function (result) {
      if (result !== undefined) {
        if (result[optInKey] === "true") {
          resolve({ status: "opted_in", boolean: true });
        } else if (result[optInKey] === "false") {
          resolve({ status: "opted_out", boolean: false });
        } else {
          resolve({ status: "undefined", boolean: false });
        }
      } else {
        resolve({ status: "undefined", boolean: false });
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
