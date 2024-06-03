import { setLocalStorage } from "./storage-helpers";

export async function getOptInStatus(): Promise<boolean> {
  return new Promise((resolve) => {
    chrome.storage.local.get("mellowtelOptIn", function (result) {
      if (result !== undefined && result["mellowtelOptIn"] === "true") {
        resolve(true);
      } else {
        resolve(false);
      }
    });
  });
}

export async function optIn(): Promise<boolean> {
  return new Promise((resolve) => {
    setLocalStorage("mellowtelOptIn", "true").then(() => {
      resolve(true);
    });
  });
}

export async function optOut(): Promise<boolean> {
  return new Promise((resolve) => {
    setLocalStorage("mellowtelOptIn", "false").then(() => {
      resolve(true);
    });
  });
}
