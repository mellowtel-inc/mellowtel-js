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
import { generateAndOpenOptInLink } from "../elements/generate-links";
import { MeasureConnectionSpeed } from "./measure-connection-speed";
import { proceedWithActivation } from "../content-script/execute-crawl";
import {
  putHTMLToSigned,
  putMarkdownToSigned,
  putHTMLVisualizerToSigned,
  putHTMLContainedToSigned,
} from "./put-to-signed";
import {
  getIfCurrentlyActiveBCK,
} from "../elements/elements-utils";
import {
  getBadgeProperties,
  hideBadge,
  restoreBadgeProperties,
  showBadge,
} from "../transparency/badge-settings";
import { handleGetRequest } from "../get-requests/get-helpers";

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
/*async function processCrawl(
    recordID: string,
    isPDF: boolean,
    event: MessageEvent,
    numTries: number,
    url_to_crawl: string,
    htmlTransformer: string,
    orgId: string,
    fastLane: boolean,
    saveText: string,
    removeCSSselectors: string,
    classNamesToBeRemoved: string[],
    html_string: string,
    htmlVisualizer: boolean,
    htmlContained: boolean,
    removeImages: boolean,
) {
    let parser: DOMParser = new DOMParser();
    let document_to_use: Document = parser.parseFromString(html_string, "text/html");
    if (removeCSSselectors === "default") {
        removeSelectorsFromDocument(document_to_use, []);
    } else if (removeCSSselectors !== "" && removeCSSselectors !== "none") {
        try {
            let selectors = JSON.parse(removeCSSselectors);
            removeSelectorsFromDocument(document_to_use, selectors);
        } catch (e) {
            Logger.error("[initCrawl 🌐] : Error parsing removeCSSselectors =>", e);
        }
    }

    let second_document_string: string = "";
    if (htmlVisualizer || htmlContained) {
        let second_document = document_to_use.cloneNode(true) as Document;
        removeSelectorsFromDocument(second_document, []);
        second_document_string = get_document_html("\n", second_document);
        second_document_string = second_document_string
            .replace(/(\r\n|\n|\r)/gm, "")
            .replace(/\\t/gm, "");
    }

    if (classNamesToBeRemoved.length > 0)
        removeElementsByClassNames(classNamesToBeRemoved);
    if (removeImages) removeImagesDOM(document_to_use);

    let doc_string = get_document_html("\n", document_to_use);
    doc_string = doc_string.replace(/(\r\n|\n|\r)/gm, "").replace(/\\t/gm, "");

    Logger.log("[🌐] : Sending data to server...");
    Logger.log("[🌐] : recordID => " + recordID);
    let markDown;
    if (!isPDF) {
        let turnDownService = new (TurndownService as any)({});
        markDown = turnDownService.turndown(
            document_to_use.documentElement.outerHTML,
        );
        Logger.log("[🌐] : markDown => " + markDown);

        if ((markDown.trim() === "" || markDown === "null") && numTries < 4) {
            Logger.log("[initCrawl 🌐] : markDown is empty. RESETTING");
            setTimeout(() => {
                //initCrawlHelper(event, numTries + 1);
            }, 2000);
        } else {
            if (htmlVisualizer) {
                // SPECIAL LOGIC FOR HTML VISUALIZER
                await saveWithVisualizer(
                    recordID,
                    doc_string,
                    markDown,
                    url_to_crawl,
                    htmlTransformer,
                    orgId,
                    second_document_string,
                );
            } else if (htmlContained) {
                // SPECIAL LOGIC FOR HTML CONTAINED
                await saveWithContained(
                    recordID,
                    doc_string,
                    markDown,
                    url_to_crawl,
                    htmlTransformer,
                    orgId,
                    second_document_string,
                );
            } else {
                saveCrawl(
                    recordID,
                    doc_string,
                    markDown,
                    fastLane,
                    url_to_crawl,
                    htmlTransformer,
                    orgId,
                    saveText,
                    event.data.hasOwnProperty("BATCH_execution")
                        ? event.data.BATCH_execution
                        : false,
                    event.data.hasOwnProperty("batch_id") ? event.data.batch_id : "",
                );
            }
        }
    } else {
        Logger.log("[initCrawl 🌐] : it's a PDF");
        let text: string = await extractTextFromPDF(url_to_crawl);
        Logger.log("[initCrawl 🌐] : text => " + text);
        if (htmlVisualizer) {
            // SPECIAL LOGIC FOR HTML VISUALIZER
            await saveWithVisualizer(
                recordID,
                text,
                text,
                url_to_crawl,
                htmlTransformer,
                orgId,
                second_document_string,
            );
        } else if (htmlContained) {
            // SPECIAL LOGIC FOR HTML CONTAINED
            await saveWithContained(
                recordID,
                text,
                text,
                url_to_crawl,
                htmlTransformer,
                orgId,
                second_document_string,
            );
        } else {
            saveCrawl(
                recordID,
                text,
                text,
                fastLane,
                url_to_crawl,
                htmlTransformer,
                orgId,
                saveText,
                event.data.hasOwnProperty("BATCH_execution")
                    ? event.data.BATCH_execution
                    : false,
                event.data.hasOwnProperty("batch_id") ? event.data.batch_id : "",
            );
        }
    }
}*/

