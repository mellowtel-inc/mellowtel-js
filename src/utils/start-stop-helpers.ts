import { isCSPEnabled } from "../content-script/test-csp";
import { setUpContentScriptListeners } from "./listener-helpers";
import { getIdentifier } from "./identity-helpers";
import { executeFunctionIfOrWhenBodyExists } from "./document-body-observer";
import { DATA_ID_IFRAME } from "../constants";

export function startMellowtelWebsocket() {
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

export function stopMellowtelConnection() {
  let iframes: NodeListOf<Element> = document.querySelectorAll(
    `[data-id="${DATA_ID_IFRAME}"]`,
  );
  iframes.forEach((iframe) => {
    iframe.remove();
  });
}

export function isMellowtelStarted(): Promise<boolean> {
  return new Promise((resolve) => {
    chrome.storage.local.get("mellowtelStatus", function (result) {
      if (result !== undefined && result["mellowtelStatus"] === "start") {
        resolve(true);
      } else {
        resolve(false);
      }
    });
  });
}
