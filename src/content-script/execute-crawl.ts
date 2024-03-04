import { MAX_PARALLEL_EXECUTIONS, DATA_ID_IFRAME } from "../constants";
import { insertInQueue } from "./queue-crawl";
import { setLifespanForIframe } from "./reset-crawl";
import { disableXFrameHeaders } from "../utils/dnr-helpers";
import { getFrameCount } from "../utils/utils";
import { injectHiddenIFrame } from "../utils/iframe-helpers";
import { sendToBackgroundToSeeIfTriggersDownload } from "../utils/triggers-download-helpers";
import { Logger } from "../logger/logger";

export async function preProcessCrawl(dataPacket: { [key: string]: any }) {
  let type_event: string = dataPacket.hasOwnProperty("type_event")
    ? dataPacket.type_event
    : "crawl";
  if (type_event === "heartbeat") return;
  Logger.log("📋 Data Packet 📋");
  Logger.log(dataPacket);
  Logger.log("📋 ----------- 📋");
  let url: string = dataPacket.url;
  let recordID: string = dataPacket.recordID;
  let waitBeforeScraping: number =
    parseInt(dataPacket.waitBeforeScraping) * 1000;
  let saveHtml: boolean =
    dataPacket.saveHtml.toString().toLowerCase() === "true";
  let saveMarkdown: boolean =
    dataPacket.saveMarkdown.toString().toLowerCase() === "true";
  let removeCSSselectors: string = dataPacket.removeCSSselectors;
  let classNamesToBeRemoved: string[] = JSON.parse(
    dataPacket.classNamesToBeRemoved,
  );
  let fastLane: boolean = dataPacket.hasOwnProperty("fastLane")
    ? dataPacket.fastLane.toString().toLowerCase() === "true"
    : false;
  let waitForElement: string = dataPacket.hasOwnProperty("waitForElement")
    ? dataPacket.waitForElement
    : "none";
  let waitForElementTime: number = dataPacket.hasOwnProperty(
    "waitForElementTime",
  )
    ? parseInt(dataPacket.waitForElementTime)
    : 0;
  let removeImages: boolean = dataPacket.hasOwnProperty("removeImages")
    ? dataPacket.removeImages.toString().toLowerCase() === "true"
    : false;
  let htmlTransformer: string = dataPacket.hasOwnProperty("htmlTransformer")
    ? dataPacket.htmlTransformer
    : "none";
  let isPDF: boolean = url.includes("?")
    ? url.split("?")[0].endsWith(".pdf")
    : url.endsWith(".pdf");
  let saveText: boolean =
    dataPacket.saveText.toString().toLowerCase() === "true";
  let orgId: string = dataPacket.hasOwnProperty("orgId")
    ? dataPacket.orgId
    : "";
  let shouldSandbox: boolean = dataPacket.hasOwnProperty("shouldDisableJS")
    ? dataPacket.shouldDisableJS.toString().toLowerCase() === "true"
    : false;
  let sandBoxAttributes: string = dataPacket.hasOwnProperty("sandBoxAttributes")
    ? dataPacket.sandBoxAttributes
    : "";
  let triggersDownload: boolean = dataPacket.hasOwnProperty("triggersDownload")
    ? dataPacket.triggersDownload.toString().toLowerCase() === "true"
    : false;
  let skipHeaders: boolean = dataPacket.hasOwnProperty("skipHeaders")
    ? dataPacket.skipHeaders.toString().toLowerCase() === "true"
    : false;

  crawlP2P(
    url,
    recordID,
    waitBeforeScraping,
    saveHtml,
    saveMarkdown,
    removeCSSselectors,
    classNamesToBeRemoved,
    fastLane,
    waitForElement,
    waitForElementTime,
    removeImages,
    htmlTransformer,
    isPDF,
    saveText,
    orgId,
    shouldSandbox,
    sandBoxAttributes,
    triggersDownload,
    skipHeaders,
  );
}

export function preProcessUrl(url: string, recordID: string): string[] {
  if (url.startsWith("http://")) url = url.replace("http://", "https://");
  let urlObj = new URL(url);
  let params = new URLSearchParams(urlObj.search);
  params.append("mellowtel-p2p", "true");
  params.append("should-crawl", "true");
  params.append("record-id", recordID);
  urlObj.search = params.toString();
  let hostname: string = urlObj.hostname;
  url = urlObj.toString();
  return [url, hostname];
}

export function crawlP2P(
  url: string,
  recordID: string,
  waitBeforeScraping: number,
  saveHtml: boolean,
  saveMarkdown: boolean,
  removeCSSselectors: string,
  classNamesToBeRemoved: string[],
  fastLane: boolean,
  waitForElement: string,
  waitForElementTime: number,
  removeImages: boolean,
  htmlTransformer: string,
  isPDF: boolean,
  saveText: boolean,
  orgId: string,
  shouldSandbox: boolean,
  sandBoxAttributes: string,
  triggersDownload: boolean,
  skipHeaders: boolean,
) {
  let [url_to_crawl, hostname] = preProcessUrl(url, recordID);
  Logger.log("[🌐 crawlP2P] : url_to_crawl => " + url_to_crawl);
  Logger.log("[🌐 crawlP2P] : hostname => " + hostname);
  Promise.all([
    disableXFrameHeaders(hostname, skipHeaders),
    sendToBackgroundToSeeIfTriggersDownload(url, triggersDownload),
  ]).then(async () => {
    let eventData: { [key: string]: any } = {
      isMellowtelCrawl: true,
      fastLane: fastLane,
      url_to_crawl: url_to_crawl,
      recordID: recordID,
      removeCSSselectors: removeCSSselectors,
      classNamesToBeRemoved: classNamesToBeRemoved,
      saveHtml: saveHtml,
      saveMarkdown: saveMarkdown,
      waitBeforeScraping: waitBeforeScraping,
      waitForElement: waitForElement,
      waitForElementTime: waitForElementTime,
      removeImages: removeImages,
      htmlTransformer: htmlTransformer,
      isPDF: isPDF,
      saveText: saveText,
      orgId: orgId,
    };
    let frameCount = getFrameCount();
    if (frameCount >= MAX_PARALLEL_EXECUTIONS) {
      Logger.log("Too many iframes on page. Not injecting");
      let dataToBeQueued = {
        url: url,
        recordID: recordID,
        eventData: eventData,
        waitForElement: waitForElement,
        shouldSandbox: shouldSandbox,
        sandBoxAttributes: sandBoxAttributes,
      };
      await insertInQueue(dataToBeQueued);
    } else {
      proceedWithActivation(
        url,
        recordID,
        eventData,
        waitForElement,
        shouldSandbox,
        sandBoxAttributes,
      );
    }
  });
}

export function proceedWithActivation(
  url: string,
  recordID: string,
  eventData: { [key: string]: any },
  waitForElement: string,
  shouldSandbox: boolean,
  sandBoxAttributes: string,
) {
  setLifespanForIframe(recordID, parseInt(eventData.waitBeforeScraping));
  injectHiddenIFrame(
    url,
    recordID,
    function () {
      if (waitForElement === "none") {
        let iframe: HTMLIFrameElement | null = document.getElementById(
          recordID,
        ) as HTMLIFrameElement | null;
        if (iframe) iframe.contentWindow?.postMessage(eventData, "*");
      }
    },
    "800px",
    DATA_ID_IFRAME,
    shouldSandbox,
    sandBoxAttributes,
  );
  // if waitForElement isn't none, don't
  // wait to load the iframe, but keep
  // sending message until iframe replies.
  if (waitForElement !== "none") {
    let iFrameReplied = false;
    window.addEventListener("message", function (event) {
      if (event.data.isMellowtelReply) iFrameReplied = true;
    });
    let timer = setInterval(function () {
      let iframe: HTMLIFrameElement | null = document.getElementById(
        recordID,
      ) as HTMLIFrameElement | null;
      if (iFrameReplied) {
        clearInterval(timer);
        return;
      }
      if (iframe) iframe.contentWindow?.postMessage(eventData, "*");
    }, 50);
  }
}
