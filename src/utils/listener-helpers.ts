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
        function (request, sender, sendResponse) {
            if (request.intent == "getLocalStorage") {
                getLocalStorage(request.key).then(sendResponse);
            }
            if (request.intent == "setLocalStorage") {
                setLocalStorage(request.key, request.value).then(sendResponse);
            }
            if (request.intent == "deleteLocalStorage") {
                deleteLocalStorage(JSON.parse(request.keys)).then(sendResponse);
            }
            if (request.intent == "disableXFrameHeaders") {
                disableXFrameHeaders(
                    request.hostname,
                    request.skipHeaders,
                ).then(sendResponse);
            }
            if (request.intent == "enableXFrameHeaders") {
                enableXFrameHeaders(request.hostname).then(sendResponse);
            }
            if (request.intent == "resetTriggersDownload") {
                resetTriggersDownload().then(sendResponse);
            }
            if (request.intent === "setSharedMemoryBCK") {
                setSharedMemoryBCK(request.key, sender.tab?.id!).then(sendResponse);
            }
            if (request.intent === "getSharedMemoryBCK") {
                getSharedMemoryBCK(request.key).then(sendResponse);
            }
            if (request.intent === "seeIfTriggersDownload") {
                seeIfTriggersDownload(
                    request.url,
                    request.triggersDownload,
                ).then(sendResponse);
            }
            if (request.intent === "deleteIframeMellowtel") {
                sendMessageToContentScript(sender.tab?.id!, {
                    target: "contentScriptMellowtel",
                    intent: "deleteIframeMellowtel",
                    recordID: request.recordID,
                }).then(sendResponse);
            }
            return true; // return true to indicate you want to send a response asynchronously
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
