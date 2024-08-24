import {
  deleteLocalStorage,
  getLocalStorage,
  setLocalStorage,
} from "./storage-helpers";
import {
  disableXFrameHeaders,
  enableXFrameHeaders,
  fixImageRenderHTMLVisualizer,
  resetImageRenderHTMLVisualizer,
} from "./dnr-helpers";
import {
  getSharedMemoryBCK,
  setSharedMemoryBCK,
} from "../content-script/shared-memory";
import {
  resetTriggersDownload,
  seeIfTriggersDownload,
} from "./triggers-download-helpers";
import { sendMessageToContentScript } from "./messaging-helpers";
import { handlePostRequest } from "../post-requests/post-helpers";
import {
  generateAndOpenOptInLink,
  generateAndOpenUpdateLink,
} from "../elements/generate-links";
import { MeasureConnectionSpeed } from "./measure-connection-speed";
import {
  putHTMLToSigned,
  putMarkdownToSigned,
  putHTMLVisualizerToSigned,
  putHTMLContainedToSigned,
} from "./put-to-signed";
import { getIfCurrentlyActiveBCK } from "../elements/elements-utils";
import {
  getBadgeProperties,
  hideBadge,
  restoreBadgeProperties,
  showBadge,
} from "../transparency/badge-settings";
import { handleGetRequest } from "../get-requests/get-helpers";
import { startConnectionWs } from "../content-script/websocket";
import { Logger } from "../logger/logger";

export async function setUpBackgroundListeners() {
  // Queue to store incoming messages to start websocket
  const startWebsocketMessageQueue: { identifier: string }[] = [];

  // Function to process messages from the queue
  function processWebsocketQueue() {
    if (startWebsocketMessageQueue.length > 0) {
      const message = startWebsocketMessageQueue.shift();
      if (message) {
        Logger.log("Processing message from queue:", message);
        Logger.log("Content script requested to start websocket");
        Logger.log(document.getElementById("webSocketConnected"));
        Logger.log("####################################");
        startConnectionWs(message.identifier);
      }
    }
    setTimeout(processWebsocketQueue, 7000); // Process next message after 7 seconds
  }

  // Start processing the queue
  processWebsocketQueue();

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
      if (request.intent === "deleteIframeM") {
        sendMessageToContentScript(sender.tab?.id!, {
          intent: "deleteIframeM",
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
      if (request.intent === "handleGETRequest") {
        handleGetRequest(
          request.method_endpoint,
          request.method_headers,
          request.fastLane,
          request.orgId,
          request.recordID,
          request.htmlVisualizer,
          request.htmlContained,
        ).then(sendResponse);
      }
      if (request.intent === "openOptInLink") {
        generateAndOpenOptInLink().then((link) => {
          sendResponse(link);
        });
      }
      if (request.intent === "openUpdateLink") {
        generateAndOpenUpdateLink().then((link) => {
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
          { active: true, lastFocusedWindow: true },
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
      if (request.intent === "handleHTMLContained") {
        chrome.tabs.query(
          { active: true, lastFocusedWindow: true },
          function (tabs) {
            if (tabs.length > 0) {
              sendMessageToContentScript(tabs[0].id!, {
                intent: "handleHTMLContained",
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
      if (request.intent === "putHTMLToSigned") {
        putHTMLToSigned(request.htmlURL_signed, request.content).then(
          sendResponse,
        );
      }
      if (request.intent === "putMarkdownToSigned") {
        putMarkdownToSigned(request.markdownURL_signed, request.markDown).then(
          sendResponse,
        );
      }
      if (request.intent === "putHTMLVisualizerToSigned") {
        putHTMLVisualizerToSigned(
          request.htmlVisualizerURL_signed,
          request.base64image,
        ).then(sendResponse);
      }
      if (request.intent === "putHTMLContainedToSigned") {
        putHTMLContainedToSigned(
          request.htmlContainedURL_signed,
          request.htmlContainedString,
        ).then(sendResponse);
      }
      if (request.intent === "fixImageRenderHTMLVisualizer") {
        fixImageRenderHTMLVisualizer().then(sendResponse);
      }
      if (request.intent === "resetImageRenderHTMLVisualizer") {
        resetImageRenderHTMLVisualizer().then(sendResponse);
      }
      if (request.intent === "getIfCurrentlyActiveBCK") {
        getIfCurrentlyActiveBCK().then(sendResponse);
      }
      if (request.intent === "showBadge") {
        showBadge().then(sendResponse);
      }
      if (request.intent === "hideBadge") {
        hideBadge().then(sendResponse);
      }
      if (request.intent === "getBadgeProperties") {
        getBadgeProperties().then(sendResponse);
      }
      if (request.intent === "restoreBadgeProperties") {
        restoreBadgeProperties().then(sendResponse);
      }
      if (request.intent === "startWebsocket") {
        startWebsocketMessageQueue.push({ identifier: request.identifier });
        sendResponse(true);
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
