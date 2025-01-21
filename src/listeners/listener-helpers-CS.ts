import { resetAfterCrawl } from "../content-script/reset-crawl";
import { CEREAL_FRAME_ID, DATA_ID_IFRAME } from "../constants";
import { hideBadgeIfShould } from "../transparency/badge-settings";
import { getSharedMemoryDOM } from "../content-script/shared-memory";
import { getIfCurrentlyActiveDOM } from "../elements/elements-utils";
import { getIdentifier } from "../utils/identity-helpers";
import { startConnectionWs } from "../content-script/websocket";
import {
  preProcessCrawl,
  proceedWithActivation,
} from "../content-script/execute-crawl";
import { Logger } from "../logger/logger";
import { initCerealFrame } from "../cereal/cereal-utils";
import { CerealFrameMessage, CerealResponse } from "../cereal/cereal-types";

export async function setUpContentScriptListeners() {
  // Global map to store pending request resolvers
  const pendingCerealRequests = new Map();

  // Single event listener for all cereal frame responses
  window.addEventListener("message", (event) => {
    // check if event is the one we are listening for
    Logger.log("[RECEIVED CEREAL? event.data] : ", event.data);
    let eventType = event.data?.type;
    if (eventType === "CEREAL_RESPONSE") {
      let cerealFrame = document.getElementById(
        CEREAL_FRAME_ID,
      ) as HTMLIFrameElement;
      if (!cerealFrame) return;
      if (event.source === cerealFrame.contentWindow) {
        const recordID = event.data.recordID;
        const json = event.data.json;
        if (recordID && pendingCerealRequests.has(recordID)) {
          Logger.log("[RECEIVED CEREAL] with recordID : ", recordID);
          const resolve = pendingCerealRequests.get(recordID);
          resolve({ success: true, data: json });
          pendingCerealRequests.delete(recordID);
        }
      }
    }
  });
  chrome.runtime.onMessage.addListener(
    function (request, sender, sendResponse) {
      (function () {
        if (request.target !== "contentScriptM") return false;
        if (request.intent === "deleteIframeM") {
          let recordID = request.recordID;
          let iframe: HTMLElement | null = document.getElementById(recordID);
          let dataId: string = iframe?.getAttribute("data-id") || "";
          let divIframe: HTMLElement | null = document.getElementById(
            "div-" + recordID,
          );
          if (iframe) iframe.remove();
          if (divIframe) divIframe.remove();
          resetAfterCrawl(
            recordID,
            request.BATCH_execution,
            request.delayBetweenExecutions,
          ).then(async () => {
            if (dataId === DATA_ID_IFRAME) {
              await hideBadgeIfShould();
            }
          });
        }
        if (request.intent === "getSharedMemoryDOM") {
          getSharedMemoryDOM(request.key).then(sendResponse);
        }
        if (request.intent === "getIfCurrentlyActiveDOM") {
          getIfCurrentlyActiveDOM().then(sendResponse);
        }
        if (request.intent === "startConnectionM") {
          getIdentifier().then((identifier: string) => {
            startConnectionWs(identifier);
          });
        }
        if (request.intent === "handleHTMLVisualizer") {
          proceedWithActivation(
            request.url,
            request.recordID,
            JSON.parse(request.eventData),
            request.waitForElement,
            request.shouldSandbox,
            request.sandBoxAttributes,
            request.BATCH_execution,
            request.batch_id,
            request.triggersDownload,
            request.skipHeaders,
            request.hostname,
            true,
            false,
            request.screenWidth,
            request.screenHeight,
            request.POST_request,
            request.GET_request,
            request.method_endpoint,
            request.method_payload,
            request.method_headers,
            request.actions,
            request.delayBetweenExecutions,
            request.openTab,
            request.openTabOnlyIfMust,
            request.pascoli,
            request.cerealObject,
            request.refPolicy,
            true, // to break the loop
          ).then(() => {
            sendResponse("success");
          });
        }
        if (request.intent === "handleHTMLContained") {
          proceedWithActivation(
            request.url,
            request.recordID,
            JSON.parse(request.eventData),
            request.waitForElement,
            request.shouldSandbox,
            request.sandBoxAttributes,
            request.BATCH_execution,
            request.batch_id,
            request.triggersDownload,
            request.skipHeaders,
            request.hostname,
            false,
            true,
            request.screenWidth,
            request.screenHeight,
            request.POST_request,
            request.GET_request,
            request.method_endpoint,
            request.method_payload,
            request.method_headers,
            request.actions,
            request.delayBetweenExecutions,
            request.openTab,
            request.openTabOnlyIfMust,
            request.pascoli,
            request.cerealObject,
            request.refPolicy,
            true, // to break the loop
          ).then(() => {
            sendResponse("success");
          });
        }
        if (request.intent === "processCrawl") {
          processCrawl(
            request.recordID,
            false,
            new MessageEvent("message", { data: {} }),
            0,
            request.method_endpoint,
            "none",
            request.orgId,
            request.fastLane,
            "false",
            request.removeCSSselectors,
            JSON.parse(request.classNamesToBeRemoved),
            request.html_string,
            request.htmlVisualizer,
            request.htmlContained,
            request.removeImages.toString() === "true",
            request.BATCH_execution.toString() === "true",
            request.batch_id,
            request.delayBetweenExecutions,
            request.openTab,
            request.openTabOnlyIfMust,
            request.saveHtml,
            request.saveMarkdown,
            request.cerealObject,
            request.refPolicy,
          ).then(() => {
            sendResponse("success");
          });
        }
        if (request.intent === "preProcessCrawl") {
          sendResponse("success");
          Logger.log("[setUpContentScriptListeners] : preProcessCrawl");
          let data = JSON.parse(request.data);
          let BATCH_execution = request.BATCH_execution;
          let batch_id = request.batch_id;
          let parallelExecutionsBatch: number = request.parallelExecutionsBatch;
          let delayBetweenExecutions: number = request.delayBetweenExecutions;
          preProcessCrawl(
            data,
            BATCH_execution,
            batch_id,
            parallelExecutionsBatch,
            delayBetweenExecutions,
          ).then(() => {
            sendResponse("success");
          });
        }
        if (request.intent === "ping") {
          Logger.log("[🌐] : ping received, replying...");
          sendResponse({
            status: "ready",
          });
        }
        if (request.intent === "triggerEventListener") {
          Logger.log("[🌐] : triggerEventListener...");
          import("../iframe/mutation-observer").then(
            (initialEventListenerModule) => {
              let event = new MessageEvent("message", {
                data: JSON.parse(request.data),
              });
              initialEventListenerModule
                .initialEventListener(event)
                .then(() => {
                  sendResponse();
                });
            },
          );
        }
        if (request.intent === "resetAfterCrawl") {
          resetAfterCrawl(
            request.recordID,
            request.BATCH_execution,
            request.delayBetweenExecutions,
          ).then(() => {
            sendResponse("success");
          });
        }
        if (request.intent === "mllwtl_initCerealFrame") {
          Logger.log("[greeting] : ", "mllwtl_initCerealFrame");
          initCerealFrame(request.cerealObject).then((result) => {
            sendResponse(result);
          });
        }
        if (request.intent === "mllwtl_processCereal") {
          Logger.log("[greeting] : ", "mllwtl_processCereal");
          let frame = document.getElementById(CEREAL_FRAME_ID);

          const processFrame = (iframeElement: HTMLIFrameElement) => {
            const { recordID, htmlString, cerealObject } = request;
            Logger.log("[PROCESS_CEREAL => recordID] : ", recordID);

            return new Promise<CerealResponse>((resolve) => {
              pendingCerealRequests.set(recordID, resolve);

              iframeElement.contentWindow?.postMessage(
                {
                  type: "PROCESS_DOCUMENT",
                  recordID: recordID,
                  htmlString: htmlString,
                  cerealObject:
                    typeof cerealObject === "string"
                      ? cerealObject
                      : JSON.stringify(cerealObject),
                } as CerealFrameMessage,
                "*",
              );

              Logger.log("[PROCESS_CEREAL => POSTED THE MESSAGE] : ", recordID);

              setTimeout(() => {
                if (pendingCerealRequests.has(recordID)) {
                  pendingCerealRequests.delete(recordID);
                  resolve({ success: false, error: "timeout" });
                }
              }, 10000);
            });
          };

          if (!frame) {
            Logger.log("[PROCESS_CEREAL] Frame not found, initializing");
            initCerealFrame(request.cerealObject).then(
              (initResult: CerealResponse) => {
                if (!initResult.success) {
                  sendResponse({ success: false, error: "frame_init_failed" });
                  return;
                }

                const newFrame = document.getElementById(CEREAL_FRAME_ID);
                if (!newFrame) {
                  sendResponse({ success: false, error: "frame_not_found" });
                  return;
                }

                processFrame(newFrame as HTMLIFrameElement).then(sendResponse);
              },
            );
          } else {
            processFrame(frame as HTMLIFrameElement).then(sendResponse);
          }
        }
        if (request.intent === "mllwtl_refreshCerealFrame") {
          Logger.log("[greeting] : ", "mllwtl_refreshCerealFrame");
          let frame = document.getElementById(CEREAL_FRAME_ID);

          if (!frame) {
            Logger.log("[REFRESH_CEREAL] Frame not found, nothing to refresh");
            sendResponse({ success: false, error: "frame_not_found" });
          }

          // Type assertion for iframe
          const iframeElement = frame as HTMLIFrameElement;

          iframeElement.src = iframeElement.src;

          Logger.log("[REFRESH_CEREAL] Frame refreshed");

          sendResponse({ success: true });
        }
      })();
      return true; // return true to indicate you want to send a response asynchronously
    },
  );
}

async function processCrawl(
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
  BATCH_execution: boolean,
  batch_id: string,
  delayBetweenExecutions: number,
  openTab: boolean,
  openTabOnlyIfMust: boolean,
  saveHtml: boolean,
  saveMarkdown: boolean,
  cerealObject: string,
  refPolicy: string,
) {
  const saveCrawlModule = await import("../iframe/save/save-crawl");
  const {
    get_document_html,
    removeElementsByClassNames,
    removeImagesDOM,
    removeSelectorsFromDocument,
  } = await import("../iframe/dom-processing");
  const TurndownModule = await import("../turndown/turndown");
  const saveWithVisualizerModule = await import(
    "../iframe/save/save-with-visualizer"
  );
  const saveWithContainedModule = await import(
    "../iframe/save/save-with-contained"
  );
  const extractTextFromPDFModule = await import("../pdf/pdf-getter");
  let parser: DOMParser = new DOMParser();
  let document_to_use: Document = parser.parseFromString(
    html_string,
    "text/html",
  );
  Logger.log("[processCrawl 🌐] : document_to_use =>");
  Logger.log(document_to_use);
  if (removeCSSselectors === "default") {
    removeSelectorsFromDocument(document_to_use, []);
  } else if (removeCSSselectors !== "" && removeCSSselectors !== "none") {
    try {
      let selectors = JSON.parse(removeCSSselectors);
      removeSelectorsFromDocument(document_to_use, selectors);
    } catch (e) {
      Logger.log("[initCrawl 🌐] : Error parsing removeCSSselectors =>", e);
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
    let turnDownService = new (TurndownModule.TurndownService as any)({});
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
        await saveWithVisualizerModule.saveWithVisualizer(
          recordID,
          doc_string,
          markDown,
          url_to_crawl,
          htmlTransformer,
          orgId,
          second_document_string,
          delayBetweenExecutions,
          openTabOnlyIfMust,
        );
      } else if (htmlContained) {
        // SPECIAL LOGIC FOR HTML CONTAINED
        await saveWithContainedModule.saveWithContained(
          recordID,
          doc_string,
          markDown,
          url_to_crawl,
          htmlTransformer,
          orgId,
          second_document_string,
          true,
          delayBetweenExecutions,
          openTabOnlyIfMust,
        );
      } else {
        saveCrawlModule.saveCrawl(
          recordID,
          doc_string,
          markDown,
          fastLane,
          url_to_crawl,
          htmlTransformer,
          orgId,
          saveText,
          saveHtml,
          saveMarkdown,
          BATCH_execution,
          batch_id,
          false,
          delayBetweenExecutions,
          openTabOnlyIfMust,
          cerealObject,
        );
      }
    }
  } else {
    Logger.log("[initCrawl 🌐] : it's a PDF");
    let text: string =
      await extractTextFromPDFModule.extractTextFromPDF(url_to_crawl);
    Logger.log("[initCrawl 🌐] : text => " + text);
    if (htmlVisualizer) {
      // SPECIAL LOGIC FOR HTML VISUALIZER
      await saveWithVisualizerModule.saveWithVisualizer(
        recordID,
        text,
        text,
        url_to_crawl,
        htmlTransformer,
        orgId,
        second_document_string,
        delayBetweenExecutions,
        openTabOnlyIfMust,
      );
    } else if (htmlContained) {
      // SPECIAL LOGIC FOR HTML CONTAINED
      await saveWithContainedModule.saveWithContained(
        recordID,
        text,
        text,
        url_to_crawl,
        htmlTransformer,
        orgId,
        second_document_string,
        false,
        delayBetweenExecutions,
        openTabOnlyIfMust,
      );
    } else {
      saveCrawlModule.saveCrawl(
        recordID,
        text,
        text,
        fastLane,
        url_to_crawl,
        htmlTransformer,
        orgId,
        saveText,
        saveHtml,
        saveMarkdown,
        BATCH_execution,
        batch_id,
        false,
        delayBetweenExecutions,
        openTabOnlyIfMust,
        cerealObject,
      );
    }
  }
}
