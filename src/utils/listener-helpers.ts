import {
  deleteLocalStorage,
  getLocalStorage,
  setLocalStorage,
} from "./storage-helpers";
import { resetAfterCrawl } from "../content-script/reset-crawl";
import { disableXFrameHeaders, enableXFrameHeaders } from "./dnr-helpers";
import {
  getSharedMemoryBCK,
  getSharedMemoryDOM,
  setSharedMemoryBCK,
} from "../content-script/shared-memory";
import { startConnectionWs } from "../content-script/websocket";
import { getIdentifier } from "./identity-helpers";
import { resetTriggersDownload, seeIfTriggersDownload } from "./triggers-download-helpers";
import { sendMessageToContentScript } from "./messaging-helpers";

export async function setUpBackgroundListeners() {
  chrome.runtime.onMessage.addListener(
    async function (request, sender, sendResponse) {
      if (request.intent == "getLocalStorage") {
        const response = await getLocalStorage(request.key);
        sendResponse(response);
      }
      if (request.intent == "setLocalStorage") {
        const response = await setLocalStorage(request.key, request.value);
        sendResponse(response);
      }
      if (request.intent == "deleteLocalStorage") {
        const response = await deleteLocalStorage(JSON.parse(request.keys));
        sendResponse(response);
      }
      if (request.intent == "disableXFrameHeaders") {
        const response = await disableXFrameHeaders(
          request.hostname,
          request.skipHeaders,
        );
        sendResponse(response);
      }
      if (request.intent == "enableXFrameHeaders") {
        const response = await enableXFrameHeaders(request.hostname);
        sendResponse(response);
      }
      if (request.intent == "resetTriggersDownload") {
        const response = await resetTriggersDownload();
        sendResponse(response);
      }
      if (request.intent === "setSharedMemoryBCK") {
        const response = await setSharedMemoryBCK(request.key, request.value);
        sendResponse(response);
      }
      if (request.intent === "getSharedMemoryBCK") {
        const response = await getSharedMemoryBCK(request.key);
        sendResponse(response);
      }
      if (request.intent === "seeIfTriggersDownload") {
        const response = await seeIfTriggersDownload(
          request.url,
          request.triggersDownload,
        );
        sendResponse(response);
      }
      if (request.intent === "deleteIframeMellowtel") {
        const response = await sendMessageToContentScript(sender.tab?.id!, {
          target: "contentScriptMellowtel",
          intent: "deleteIframeMellowtel",
          recordID: request.recordID,
        });
        sendResponse(response);
      }
    },
  );
}

export async function setUpContentScriptListeners() {
  chrome.runtime.onMessage.addListener(
    async function (request, sender, sendResponse) {
      if (request.target !== "contentScriptMellowtel") return false;
      if (request.intent === "deleteIframeMellowtel") {
        let recordID = request.recordID;
        let iframe = document.getElementById(recordID);
        if (iframe) iframe.remove();
        await resetAfterCrawl(recordID);
      }
      if (request.intent === "getSharedMemoryDOM") {
        getSharedMemoryDOM(request.key).then(sendResponse);
      }
      if (request.intent === "startConnectionMellowtel") {
        getIdentifier().then((identifier: string) => {
          startConnectionWs(identifier);
        });
      }
      return true; // return true to indicate you want to send a response asynchronously
    },
  );
}
