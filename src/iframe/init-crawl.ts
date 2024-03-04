import { isPdfEmbedElementPresent } from "./check-pdf";
import {
  get_document_html,
  removeElementsByClassNames,
  removeImagesDOM,
  removeSelectorsFromDocument,
} from "./dom-processing";
import { saveCrawl } from "./save-crawl";
import { TurndownService } from "../turndown/turndown";
import { extractTextFromPDF } from "../pdf/pdf-getter";
import { Logger } from "../logger/logger";
export async function initCrawl(event: MessageEvent, shouldDispatch: boolean) {
  window.addEventListener("message", async function (event) {
    let isMellowtelCrawl = event.data.isMellowtelCrawl;
    if (isMellowtelCrawl) {
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

      /** TECHCRUNCH SUPPORT */
      let shouldContinueAfterConsent = true;
      if (window.location.host === "consent.yahoo.com") {
        setTimeout(() => {
          let agree = document.getElementsByName("agree")[0];
          if (agree) {
            shouldContinueAfterConsent = false;
            agree.click();
          }
        }, 0);
      }
      if (!shouldContinueAfterConsent) return;
      /** TECHCRUNCH SUPPORT */

      let waitBeforeScraping = parseInt(event.data.waitBeforeScraping);
      Logger.log("[initCrawl]: waitBeforeScraping " + waitBeforeScraping);
      setTimeout(async () => {
        let host_window = window.location.host;
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

        if (host_window === "www.reuters.com") {
          let response = await fetch(window.location.href);
          let html = await response.text();
          let parser = new DOMParser();
          document_to_use = parser.parseFromString(html, "text/html");
        }

        if (removeCSSselectors === "default")
          removeSelectorsFromDocument(document_to_use);
        if (classNamesToBeRemoved.length > 0)
          removeElementsByClassNames(classNamesToBeRemoved);
        if (removeImages) removeImagesDOM(document_to_use);

        let doc_string = get_document_html("\n", document_to_use);
        doc_string = doc_string
          .replace(/(\r\n|\n|\r)/gm, "")
          .replace(/\\t/gm, "");

        Logger.log("[🌐] : Sending data to server...");
        Logger.log("[🌐] : recordID => " + recordID);
        let markDown;
        if (!isPDF) {
          let turnDownService = new (TurndownService as any)({});
          markDown = turnDownService.turndown(
            document_to_use.documentElement.outerHTML,
          );
          Logger.log("[🌐] : markDown => " + markDown);

          saveCrawl(
            recordID,
            doc_string,
            markDown,
            fastLane,
            url_to_crawl,
            htmlTransformer,
            orgId,
            saveText,
          );
        } else {
          Logger.log("[initCrawl 🌐] : it's a PDF");
          let text: string = await extractTextFromPDF(url_to_crawl);
          Logger.log("[initCrawl 🌐] : text => " + text);
          saveCrawl(
            recordID,
            text,
            text,
            fastLane,
            url_to_crawl,
            htmlTransformer,
            orgId,
            saveText,
          );
        }
      }, waitBeforeScraping);
    }
  });
  if (shouldDispatch) {
    window.dispatchEvent(
      new MessageEvent("message", {
        data: event.data,
      }),
    );
  }
}
