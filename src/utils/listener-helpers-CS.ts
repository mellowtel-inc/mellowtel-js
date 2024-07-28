import { resetAfterCrawl } from "../content-script/reset-crawl";
import { DATA_ID_IFRAME } from "../constants";
import { hideBadgeIfShould } from "../transparency/badge-settings";
import { getSharedMemoryDOM } from "../content-script/shared-memory";
import { getIfCurrentlyActiveDOM } from "../elements/elements-utils";
import { getIdentifier } from "./identity-helpers";
import { startConnectionWs } from "../content-script/websocket";
import { proceedWithActivation } from "../content-script/execute-crawl";
import { Logger } from "../logger/logger";

export async function setUpContentScriptListeners() {
  chrome.runtime.onMessage.addListener(
    async function (request, sender, sendResponse) {
      if (request.target !== "contentScriptM") return false;
      if (request.intent === "deleteIframeM") {
        let recordID = request.recordID;
        let iframe = document.getElementById(recordID);
        let dataId = iframe?.getAttribute("data-id") || "";
        let divIframe = document.getElementById("div-" + recordID);
        if (iframe) iframe.remove();
        if (divIframe) divIframe.remove();
        await resetAfterCrawl(recordID, request.BATCH_execution);
        if (dataId === DATA_ID_IFRAME) {
          await hideBadgeIfShould();
        }
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
          false,
          true, // to break the loop
        );
      }
      if (request.intent === "handleHTMLContained") {
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
          false,
          true,
          true, // to break the loop
        );
      }
      if (request.intent === "processCrawl") {
        await processCrawl(
          request.recordID,
          false,
          new MessageEvent("message", { data: {} }),
          0,
          request.method_endpoint,
          "none",
          request.orgId,
          request.fastLane,
          "false",
          "",
          [],
          request.html_string,
          request.htmlVisualizer,
          request.htmlContained,
          false,
        );
      }
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
) {
  const saveCrawlModule = await import("../iframe/save-crawl");
  const {
    get_document_html,
    removeElementsByClassNames,
    removeImagesDOM,
    removeSelectorsFromDocument,
  } = await import("../iframe/dom-processing");
  const TurndownModule = await import("../turndown/turndown");
  const saveWithVisualizerModule = await import(
    "../iframe/save-with-visualizer"
  );
  const saveWithContainedModule = await import("../iframe/save-with-contained");
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
          event.data.hasOwnProperty("BATCH_execution")
            ? event.data.BATCH_execution
            : false,
          event.data.hasOwnProperty("batch_id") ? event.data.batch_id : "",
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
        event.data.hasOwnProperty("BATCH_execution")
          ? event.data.BATCH_execution
          : false,
        event.data.hasOwnProperty("batch_id") ? event.data.batch_id : "",
      );
    }
  }
}
