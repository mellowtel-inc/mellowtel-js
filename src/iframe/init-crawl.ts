import { isPdfEmbedElementPresent } from "./check-pdf";
import {
  get_document_html,
  removeElementsByClassNames,
  removeImagesDOM,
  removeSelectorsFromDocument,
} from "./dom-processing";
import { saveCrawl } from "./save/save-crawl";
import { TurndownService } from "../turndown/turndown";
import { extractTextFromPDF } from "../pdf/pdf-getter";
import { Logger } from "../logger/logger";
import { saveWithVisualizer } from "./save/save-with-visualizer";
import { saveWithContained } from "./save/save-with-contained";
import { Action, executeActions } from "./actions";
export async function initCrawl(event: MessageEvent, shouldDispatch: boolean) {
  window.addEventListener("message", async function (event) {
    initCrawlHelper(event, 0);
  });
  if (shouldDispatch) {
    window.dispatchEvent(
      new MessageEvent("message", {
        data: event.data,
      }),
    );
  }
}

function initCrawlHelper(event: MessageEvent, numTries: number) {
  let isMCrawl = event.data.isMCrawl;
  if (isMCrawl) {
    let recordID = event.data.recordID;
    let removeCSSselectors = event.data.removeCSSselectors;
    let classNamesToBeRemoved = event.data.classNamesToBeRemoved;
    let fastLane = event.data.hasOwnProperty("fastLane")
      ? event.data.fastLane
      : false;
    let url_to_crawl = event.data.hasOwnProperty("url_to_crawl")
      ? event.data.url_to_crawl
      : "";
    let htmlTransformer = event.data.hasOwnProperty("htmlTransformer")
      ? event.data.htmlTransformer
      : "none";
    let removeImages = event.data.hasOwnProperty("removeImages")
      ? event.data.removeImages.toString().toLowerCase() === "true"
      : false;
    let htmlVisualizer: boolean = event.data.hasOwnProperty("htmlVisualizer")
      ? event.data.htmlVisualizer.toString().toLowerCase() === "true"
      : true;
    let htmlContained: boolean = event.data.hasOwnProperty("htmlContained")
      ? event.data.htmlContained.toString().toLowerCase() === "true"
      : false;
    let actions: Action[] = event.data.hasOwnProperty("actions")
      ? JSON.parse(event.data.actions)
      : [];
    let saveHtml: boolean = event.data.hasOwnProperty("saveHtml")
      ? event.data.saveHtml.toString().toLowerCase() === "true"
      : false;
    let saveMarkdown: boolean = event.data.hasOwnProperty("saveMarkdown")
      ? event.data.saveMarkdown.toString().toLowerCase() === "true"
      : false;
    let cerealObject: string = event.data.hasOwnProperty("cerealObject")
      ? event.data.cerealObject
      : "{}";
    let rawData: boolean = event.data.hasOwnProperty("rawData")
      ? event.data.rawData.toString().toLowerCase() === "true"
      : false;

    let waitBeforeScraping = parseInt(event.data.waitBeforeScraping);
    Logger.log("[initCrawl]: waitBeforeScraping " + waitBeforeScraping);
    Logger.log("[initCrawl]: rawData " + rawData);
    setTimeout(async () => {
      let document_to_use = document;
      let url_check_pdf = window.location.href;
      let isPDF = url_check_pdf.includes("?")
        ? url_check_pdf.split("?")[0].endsWith(".pdf")
        : url_check_pdf.endsWith(".pdf");
      if (!isPDF) isPDF = isPdfEmbedElementPresent();
      let orgId = event.data.hasOwnProperty("orgId") ? event.data.orgId : "";
      let saveText = event.data.hasOwnProperty("saveText")
        ? event.data.saveText
        : false;

      let fetchInstead = event.data.hasOwnProperty("fetchInstead")
        ? event.data.fetchInstead.toString().toLowerCase() === "true"
        : false;
      if (fetchInstead) {
        let response = await fetch(window.location.href);
        let html = await response.text();
        let parser = new DOMParser();
        document_to_use = parser.parseFromString(html, "text/html");
      }
      if (actions.length > 0) {
        await executeActions(actions, document_to_use);
      }

      await processCrawl(
        recordID,
        isPDF,
        event,
        numTries,
        url_to_crawl,
        htmlTransformer,
        orgId,
        fastLane,
        saveText,
        removeCSSselectors,
        classNamesToBeRemoved,
        document_to_use,
        htmlVisualizer,
        htmlContained,
        removeImages,
        saveHtml,
        saveMarkdown,
        cerealObject,
        rawData,
      );
    }, waitBeforeScraping);
  }
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
  document_to_use: Document,
  htmlVisualizer: boolean,
  htmlContained: boolean,
  removeImages: boolean,
  saveHtml: boolean,
  saveMarkdown: boolean,
  cerealObject: string,
  rawData: boolean,
) {
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
    if (saveMarkdown || htmlVisualizer || htmlContained) {
      let turnDownService = new (TurndownService as any)({});
      markDown = turnDownService.turndown(
        document_to_use.documentElement.outerHTML,
      );
      Logger.log("[🌐] : markDown => " + markDown);
    } else {
      markDown = "";
    }

    if ((markDown.trim() === "" || markDown === "null") && numTries < 4) {
      Logger.log("[initCrawl 🌐] : markDown is empty. RESETTING");
      setTimeout(() => {
        initCrawlHelper(event, numTries + 1);
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
          false,
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
          saveHtml,
          saveMarkdown,
          event.data.hasOwnProperty("BATCH_execution")
            ? event.data.BATCH_execution
            : false,
          event.data.hasOwnProperty("batch_id") ? event.data.batch_id : "",
          false,
          500,
          false,
          cerealObject,
        );
      }
    }
  } else {
    Logger.log("[initCrawl 🌐] : it's a PDF");
    let text: string = await extractTextFromPDF(url_to_crawl, rawData);
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
        false,
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
        saveHtml,
        saveMarkdown,
        event.data.hasOwnProperty("BATCH_execution")
          ? event.data.BATCH_execution
          : false,
        event.data.hasOwnProperty("batch_id") ? event.data.batch_id : "",
        false,
        500,
        false,
        cerealObject,
      );
    }
  }
}
