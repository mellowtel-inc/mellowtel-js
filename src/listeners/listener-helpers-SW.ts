import {
  disableXFrameHeaders,
  enableXFrameHeaders,
  fixImageRenderHTMLVisualizer,
  resetImageRenderHTMLVisualizer,
} from "../dnr/dnr-helpers";
import {
  getSharedMemoryBCK,
  setSharedMemoryBCK,
} from "../content-script/shared-memory";
import {
  resetTriggersDownload,
  seeIfTriggersDownload,
} from "../utils/triggers-download-helpers";
import { sendMessageToContentScript } from "../utils/messaging-helpers";
import { handlePostRequest } from "../post-requests/post-helpers";
import {
  generateAndOpenFeedbackLink,
  generateAndOpenOptInLink,
  generateAndOpenUpdateLink,
} from "../elements/generate-links";
import { MeasureConnectionSpeed } from "../utils/measure-connection-speed";
import {
  putHTMLToSigned,
  putMarkdownToSigned,
  putHTMLVisualizerToSigned,
  putHTMLContainedToSigned,
} from "../utils/put-to-signed";
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
import { cerealMain } from "../cereal/cereal-index";
import { startPing, stopPing } from "../background-script/keep-ping";

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
        // Logger.log(document.getElementById("webSocketConnected"));
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
        seeIfTriggersDownload(
          request.url,
          request.triggersDownload,
          request.recordID,
        ).then(sendResponse);
      }
      if (request.intent === "deleteIframeM") {
        sendMessageToContentScript(sender.tab?.id!, {
          intent: "deleteIframeM",
          recordID: request.recordID,
          BATCH_execution: request.BATCH_execution,
          delayBetweenExecutions: request.delayBetweenExecutions,
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
          request.htmlVisualizer,
          request.htmlContained,
          request.removeImages,
          request.removeCSSselectors,
          request.classNamesToBeRemoved,
          request.htmlTransformer,
          request.BATCH_execution,
          request.batch_id,
          request.actions,
          request.delayBetweenExecutions,
          request.openTab,
          request.openTabOnlyIfMust,
          request.saveHtml,
          request.saveMarkdown,
          request.cerealObject,
          request.refPolicy,
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
          request.removeImages,
          request.removeCSSselectors,
          request.classNamesToBeRemoved,
          request.htmlTransformer,
          request.BATCH_execution,
          request.batch_id,
          request.actions,
          request.delayBetweenExecutions,
          request.openTab,
          request.openTabOnlyIfMust,
          request.saveHtml,
          request.saveMarkdown,
          request.cerealObject,
          request.refPolicy,
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
                batch_id: request.batch_id,
                triggersDownload: request.triggersDownload,
                skipHeaders: request.skipHeaders,
                hostname: request.hostname,
                screenWidth: request.screenWidth,
                screenHeight: request.screenHeight,
                POST_request: request.POST_request,
                GET_request: request.GET_request,
                methodEndpoint: request.methodEndpoint,
                methodPayload: request.methodPayload,
                methodHeaders: request.methodHeaders,
                actions: request.actions,
                delayBetweenExecutions: request.delayBetweenExecutions,
                openTab: request.openTab,
                openTabOnlyIfMust: request.openTabOnlyIfMust,
                pascoli: request.pascoli,
                cerealObject: request.cerealObject,
                refPolicy: request.refPolicy,
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
                batch_id: request.batch_id,
                triggersDownload: request.triggersDownload,
                skipHeaders: request.skipHeaders,
                hostname: request.hostname,
                screenWidth: request.screenWidth,
                screenHeight: request.screenHeight,
                POST_request: request.POST_request,
                GET_request: request.GET_request,
                methodEndpoint: request.methodEndpoint,
                methodPayload: request.methodPayload,
                methodHeaders: request.methodHeaders,
                actions: request.actions,
                delayBetweenExecutions: request.delayBetweenExecutions,
                openTab: request.openTab,
                openTabOnlyIfMust: request.openTabOnlyIfMust,
                pascoli: request.pascoli,
                cerealObject: request.cerealObject,
                refPolicy: request.refPolicy,
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
      if (request.intent === "openFeedbackLink") {
        generateAndOpenFeedbackLink().then((link) => {
          sendResponse(link);
        });
      }
      if (request.intent === "mllwtl_handleCerealRequest") {
        cerealMain(request.cerealObject, request.recordID, request.htmlString)
          .then((result) => {
            Logger.log("LISTENER: mllwtl_handleCerealRequest");
            Logger.log(result);
            sendResponse(result);
          })
          .catch((error) => {
            sendResponse({ success: false, error: error.message });
          });
      }
      if (request.intent === "mllwtl_startPing") {
        startPing().then(sendResponse);
      }
      if (request.intent === "mllwtl_stopPing") {
        stopPing().then(sendResponse);
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
