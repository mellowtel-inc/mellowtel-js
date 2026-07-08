import { setLocalStorage } from "../storage/storage-helpers";
import { stop } from "./start-stop-helpers";

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
  await setLocalStorage(optInKey, "false");
  // Tear down the live connection: stops the keep-alive ping, sets mStatus to
  // "stop", and closes the websocket. Without this the service worker (and its
  // socket) can stay alive and keep processing jobs after opt-out.
  await stop();
  return true;
}
