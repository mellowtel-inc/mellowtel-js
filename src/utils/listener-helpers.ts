import {
  deleteLocalStorage,
  getLocalStorage,
  setLocalStorage,
} from "./storage-helpers";
import { resetAfterCrawl } from "../content-script/reset-crawl";
import {
  disableXFrameHeaders,
  enableXFrameHeaders,
  fixImageRenderHTMLVisualizer,
  resetImageRenderHTMLVisualizer,
} from "./dnr-helpers";
import {
  getSharedMemoryBCK,
  getSharedMemoryDOM,
  setSharedMemoryBCK,
} from "../content-script/shared-memory";
import { startConnectionWs } from "../content-script/websocket";
import { getIdentifier } from "./identity-helpers";
import {
  resetTriggersDownload,
  seeIfTriggersDownload,
} from "./triggers-download-helpers";
import { sendMessageToContentScript } from "./messaging-helpers";
import { handlePostRequest } from "../post-requests/post-helpers";
import { generateAndOpenOptInLink } from "../mellowtel-elements/generate-links";
import { MeasureConnectionSpeed } from "./measure-connection-speed";
import { proceedWithActivation } from "../content-script/execute-crawl";
import {
  putHTMLToSigned,
  putMarkdownToSigned,
  putHTMLVisualizerToSigned,
} from "./put-to-signed";
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
        disableXFrameHeaders(request.hostname, request.skipHeaders).then(
          sendResponse,
        );
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
        seeIfTriggersDownload(request.url, request.triggersDownload).then(
          sendResponse,
        );
      }
      if (request.intent === "deleteIframeMellowtel") {
        sendMessageToContentScript(sender.tab?.id!, {
          target: "contentScriptMellowtel",
          intent: "deleteIframeMellowtel",
          recordID: request.recordID,
          BATCH_execution: request.BATCH_execution,
        }).then(sendResponse);
      }
      if (request.intent === "handlePOSTRequest") {
        handlePostRequest(
          request.method_endpoint,
          request.method_payload,
          request.method_headers,
          request.fastLane,
          request.orgId,
          request.recordID,
        ).then(sendResponse);
      }
      if (request.intent === "openOptInLink") {
        generateAndOpenOptInLink().then((link) => {
          sendResponse(link);
        });
      }
      if (request.intent === "removeCurrentTab") {
        let tabId = sender.tab?.id;
        if (tabId !== null && tabId !== undefined) {
          chrome.tabs.remove(tabId);
        }
        sendResponse(sender.tab?.id);
      }
      if (request.intent === "measureConnectionSpeed") {
        MeasureConnectionSpeed().then((speedMbps) => {
          sendResponse(speedMbps);
        });
      }
      if (request.intent === "handleHTMLVisualizer") {
        chrome.tabs.query(
          { active: true, currentWindow: true },
          function (tabs) {
            if (tabs.length > 0) {
              sendMessageToContentScript(tabs[0].id!, {
                intent: "handleHTMLVisualizer",
                url: request.url,
                recordID: request.recordID,
                eventData: request.eventData,
                waitForElement: request.waitForElement,
                shouldSandbox: request.shouldSandbox,
                sandBoxAttributes: request.sandBoxAttributes,
                BATCH_execution: request.BATCH_execution,
                triggerDownload: request.triggerDownload,
                skipHeaders: request.skipHeaders,
                hostname: request.hostname,
              });
            }
          },
        );
      }
      // putHTMLToSigned
      if (request.intent === "putHTMLToSigned") {
        putHTMLToSigned(request.htmlURL_signed, request.content).then(
          sendResponse,
        );
      }
      // putMarkdownToSigned
      if (request.intent === "putMarkdownToSigned") {
        putMarkdownToSigned(request.markdownURL_signed, request.markDown).then(
          sendResponse,
        );
      }
      // putHTMLVisualizerToSigned
      if (request.intent === "putHTMLVisualizerToSigned") {
        putHTMLVisualizerToSigned(
          request.htmlVisualizerURL_signed,
          request.base64image,
        ).then(sendResponse);
      }
      // fixImageRenderHTMLVisualizer
      if (request.intent === "fixImageRenderHTMLVisualizer") {
        fixImageRenderHTMLVisualizer().then(sendResponse);
      }
      // resetImageRenderHTMLVisualizer
      if (request.intent === "resetImageRenderHTMLVisualizer") {
        resetImageRenderHTMLVisualizer().then(sendResponse);
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
        await resetAfterCrawl(recordID, request.BATCH_execution);
      }
      if (request.intent === "getSharedMemoryDOM") {
        getSharedMemoryDOM(request.key).then(sendResponse);
      }
      if (request.intent === "startConnectionMellowtel") {
        getIdentifier().then((identifier: string) => {
          startConnectionWs(identifier);
        });
      }
      if (request.intent === "handleHTMLVisualizer") {
        await proceedWithActivation(
          request.url,
          request.recordID,
          JSON.parse(request.eventData),
          request.waitForElement,
          request.shouldSandbox,
          request.sandBoxAttributes,
          request.BATCH_execution,
          request.triggerDownload,
          request.skipHeaders,
          request.hostname,
          true,
          true, // to break the loop
        );
      }
      return true; // return true to indicate you want to send a response asynchronously
    },
  );
}

export function shouldRerouteToBackground(): Promise<boolean> {
  return new Promise((resolve) => {
    try {
      chrome.declarativeNetRequest.getDynamicRules((rules) => {
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
