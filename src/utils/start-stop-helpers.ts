import { isCSPEnabled } from "../content-script/test-csp";
import { setUpContentScriptListeners } from "../listeners/listener-helpers-CS";
import { getIdentifier } from "./identity-helpers";
import { executeFunctionIfOrWhenBodyExists } from "./document-body-observer";
import { DATA_ID_IFRAME } from "../constants";
import { checkRequiredPermissions } from "../permissions/permission-helpers";
import { setLocalStorage } from "../storage/storage-helpers";
import { getOptInStatus, optOut } from "./opt-in-out-helpers";
import { Logger } from "../logger/logger";
import { startPing, stopPing } from "../background-script/keep-ping";

export function start(metadata_id?: string | undefined): Promise<boolean> {
  return new Promise(async (resolve) => {
    let optInStatus: boolean = (await getOptInStatus()).boolean;
    if (!optInStatus) {
      throw new Error(
        "User has not opted in yet. Request a disclaimer to the end-user and then call the optIn() method if they agree to join.",
      );
    }
    try {
      await checkRequiredPermissions(true);
      // note: in later version, metadata_id will be used to trace the #...
      // ...of requests to this specific device, so you can give rewards, etc.
      await startPing();
      setLocalStorage("mStatus", "start").then(() => {
        resolve(true);
      });
    } catch (error) {
      Logger.log("[start] : Error starting the extension", error);
      await optOut();
      resolve(false);
    }
  });
}

export function stop(): Promise<boolean> {
  return new Promise(async (resolve) => {
    await stopPing();
    setLocalStorage("mStatus", "stop").then(() => {
      resolve(true);
    });
  });
}

export function startWebsocket() {
  executeFunctionIfOrWhenBodyExists(() => {
    isCSPEnabled().then(async (cspEnabled: boolean) => {
      if (!cspEnabled) {
        await setUpContentScriptListeners();
        const websocketModule = await import("../content-script/websocket");
        getIdentifier().then((identifier: string) => {
          websocketModule.startConnectionWs(identifier);
        });
      }
    });
  });
}

export function stopConnection() {
  // todo: send message to background, and remove all iframes
  let iframes: NodeListOf<Element> = document.querySelectorAll(
    `[data-id="${DATA_ID_IFRAME}"]`,
  );
  iframes.forEach((iframe) => {
    iframe.remove();
  });
}

export function isStarted(): Promise<boolean> {
  return new Promise((resolve) => {
    chrome.storage.local.get("mStatus", function (result) {
      if (result !== undefined && result["mStatus"] === "start") {
        resolve(true);
      } else {
        resolve(false);
      }
    });
  });
}
