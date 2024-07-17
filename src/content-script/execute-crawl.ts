import {
  MAX_PARALLEL_EXECUTIONS,
  DATA_ID_IFRAME,
  DATA_ID_IFRAME_BATCH,
  MAX_PARALLEL_EXECUTIONS_BATCH,
} from "../constants";
import { insertInQueue } from "./queue-crawl";
import { setLifespanForIframe } from "./reset-crawl";
import { disableXFrameHeaders } from "../utils/dnr-helpers";
import { getFrameCount } from "../utils/utils";
import { insertIFrame } from "../utils/iframe-helpers";
import { sendToBackgroundToSeeIfTriggersDownload } from "../utils/triggers-download-helpers";
import { Logger } from "../logger/logger";
import { sendMessageToBackground } from "../utils/messaging-helpers";

function fromDataPacketToNecessaryElements(dataPacket: { [key: string]: any }) {
  Logger.log(
    "[fromDataPacketToNecessaryElements] : dataPacket => ",
    dataPacket,
  );
  let fastLane = dataPacket.hasOwnProperty("fastLane")
    ? dataPacket.fastLane.toString().toLowerCase() === "true"
    : false;
  let orgId = dataPacket.hasOwnProperty("orgId") ? dataPacket.orgId : "";
  let recordID = dataPacket.recordID;
  let url = dataPacket.url;
  let waitBeforeScraping = parseInt(dataPacket.waitBeforeScraping) * 1000;
  let saveHtml = dataPacket.hasOwnProperty("saveHtml")
    ? dataPacket.saveHtml.toString().toLowerCase() === "true"
    : false;
  let saveMarkdown = dataPacket.hasOwnProperty("saveMarkdown")
    ? dataPacket.saveMarkdown.toString().toLowerCase() === "true"
    : false;
  let removeCSSselectors = dataPacket.removeCSSselectors;
  let classNamesToBeRemoved = JSON.parse(dataPacket.classNamesToBeRemoved);
  let waitForElement = dataPacket.hasOwnProperty("waitForElement")
    ? dataPacket.waitForElement
    : "none";
  let waitForElementTime = dataPacket.hasOwnProperty("waitForElementTime")
    ? parseInt(dataPacket.waitForElementTime)
    : 0;
  let removeImages = dataPacket.hasOwnProperty("removeImages")
    ? dataPacket.removeImages.toString().toLowerCase() === "true"
    : false;
  let htmlTransformer = dataPacket.hasOwnProperty("htmlTransformer")
    ? dataPacket.htmlTransformer
    : "none";
  let isPDF = url.includes("?")
    ? url.split("?")[0].endsWith(".pdf")
    : url.endsWith(".pdf");
  let saveText = dataPacket.saveText.toString().toLowerCase() === "true";
  let shouldSandbox = dataPacket.hasOwnProperty("shouldDisableJS")
    ? dataPacket.shouldDisableJS.toString().toLowerCase() === "true"
    : false;
  let sandBoxAttributes = dataPacket.hasOwnProperty("sandBoxAttributes")
    ? dataPacket.sandBoxAttributes
    : "";
  let triggersDownload = dataPacket.hasOwnProperty("triggersDownload")
    ? dataPacket.triggersDownload.toString().toLowerCase() === "true"
    : false;
  let skipHeaders = dataPacket.hasOwnProperty("skipHeaders")
    ? dataPacket.skipHeaders.toString().toLowerCase() === "true"
    : false;
  let fetchInstead = dataPacket.hasOwnProperty("fetchInstead")
    ? dataPacket.fetchInstead.toString().toLowerCase() === "true"
    : false;
  let htmlVisualizer = dataPacket.hasOwnProperty("htmlVisualizer")
    ? dataPacket.htmlVisualizer.toString().toLowerCase() === "true"
    : false;
  let htmlContained = dataPacket.hasOwnProperty("htmlContained")
    ? dataPacket.htmlContained.toString().toLowerCase() === "true"
    : false;
  return {
    fastLane,
    orgId,
    recordID,
    url,
    waitBeforeScraping,
    saveHtml,
    saveMarkdown,
    removeCSSselectors,
    classNamesToBeRemoved,
    waitForElement,
    waitForElementTime,
    removeImages,
    htmlTransformer,
    isPDF,
    saveText,
    shouldSandbox,
    sandBoxAttributes,
    triggersDownload,
    skipHeaders,
    fetchInstead,
    htmlVisualizer,
    htmlContained,
  };
}

export async function preProcessCrawl(
  dataPacket: { [key: string]: any },
  POST_request: boolean = false,
  BATCH_execution: boolean = false,
  batch_id: string = "",
) {
  Logger.log("📋 Data Packet 📋");
  Logger.log(dataPacket);
  Logger.log("📋 ----------- 📋");
  let fastLane: boolean = dataPacket.hasOwnProperty("fastLane")
    ? dataPacket.fastLane.toString().toLowerCase() === "true"
    : false;
  let orgId: string = dataPacket.hasOwnProperty("orgId")
    ? dataPacket.orgId
    : "";
  let recordID: string = dataPacket.recordID;
  if (POST_request) {
    await sendMessageToBackground({
      intent: "handlePOSTRequest",
      method_endpoint: dataPacket.method_endpoint,
      method_payload: dataPacket.method_payload,
      method_headers: dataPacket.method_headers,
      fastLane: fastLane,
      orgId: orgId,
      recordID: recordID,
    });
  } else {
    // if BATCH_execution is true:
    // dataPacket has batch_array (which we have to JSON.parse) and batch_id.
    // In that case Promise.all over all the batch_array elements
    // + can avoid getting frameCount and just insert in queue (a different queue)
    // Inject 4 at a time. Keep the rest in queue and slowly inject them as the
    // previous ones finish.
    let promiseArray: Promise<any>[] = [];
    let dataPacketArray = [];
    let index_to_arrive: number = 1;

    if (BATCH_execution) {
      dataPacketArray = JSON.parse(dataPacket.batch_array);
      index_to_arrive = dataPacketArray.length > 4 ? 4 : dataPacketArray.length;
    } else {
      dataPacketArray.push(dataPacket);
    }

    for (let i = 0; i < index_to_arrive; i++) {
      let dataPacket = dataPacketArray[i];

      let {
        fastLane,
        orgId,
        recordID,
        url,
        waitBeforeScraping,
        saveHtml,
        saveMarkdown,
        removeCSSselectors,
        classNamesToBeRemoved,
        waitForElement,
        waitForElementTime,
        removeImages,
        htmlTransformer,
        isPDF,
        saveText,
        shouldSandbox,
        sandBoxAttributes,
        triggersDownload,
        skipHeaders,
        fetchInstead,
        htmlVisualizer,
        htmlContained,
      } = fromDataPacketToNecessaryElements(dataPacket);

      promiseArray.push(
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
          BATCH_execution,
          batch_id,
          fetchInstead,
          htmlVisualizer,
          htmlContained,
        ),
      );
    }
    if (BATCH_execution) {
      for (let i = index_to_arrive; i < dataPacketArray.length; i++) {
        let dataPacket = dataPacketArray[i];
        let {
          fastLane,
          orgId,
          recordID,
          url,
          waitBeforeScraping,
          saveHtml,
          saveMarkdown,
          removeCSSselectors,
          classNamesToBeRemoved,
          waitForElement,
          waitForElementTime,
          removeImages,
          htmlTransformer,
          isPDF,
          saveText,
          shouldSandbox,
          sandBoxAttributes,
          triggersDownload,
          skipHeaders,
          fetchInstead,
          htmlVisualizer,
          htmlContained,
        } = fromDataPacketToNecessaryElements(dataPacket);
        let eventData: { [key: string]: any } = {
          isMCrawl: true,
          fastLane: fastLane,
          url_to_crawl: url,
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
          BATCH_execution: BATCH_execution,
          batch_id: batch_id,
          fetchInstead: fetchInstead,
          htmlVisualizer: htmlVisualizer,
          htmlContained: htmlContained,
        };
        let dataToBeQueued = {
          url: dataPacketArray[i].url,
          recordID: dataPacketArray[i].recordID,
          eventData: eventData,
          waitForElement: dataPacketArray[i].waitForElement,
          shouldSandbox: shouldSandbox,
          sandBoxAttributes: sandBoxAttributes,
          triggersDownload: triggersDownload,
          skipHeaders: skipHeaders,
          hostname: "",
          htmlVisualizer: htmlVisualizer,
          htmlContained: htmlContained,
        };
        await insertInQueue(dataToBeQueued, BATCH_execution);
      }
    }
    await Promise.all(promiseArray);
  }
}

export function preProcessUrl(url: string, recordID: string): string[] {
  if (url.startsWith("http://")) url = url.replace("http://", "https://");
  let urlObj = new URL(url);
  let params = new URLSearchParams(urlObj.search);
  params.append("sb-p2p", "true");
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
  BATCH_execution: boolean,
  batch_id: string = "",
  fetchInstead: boolean = false,
  htmlVisualizer: boolean = false,
  htmlContained: boolean = false,
): Promise<string> {
  return new Promise((resolve) => {
    let [url_to_crawl, hostname] = preProcessUrl(url, recordID);
    Logger.log("[🌐 crawlP2P] : url_to_crawl => " + url_to_crawl);
    Logger.log("[🌐 crawlP2P] : hostname => " + hostname);
    Promise.all([
      disableXFrameHeaders(hostname, skipHeaders),
      sendToBackgroundToSeeIfTriggersDownload(url, triggersDownload),
    ]).then(async () => {
      let eventData: { [key: string]: any } = {
        isMCrawl: true,
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
        BATCH_execution: BATCH_execution,
        batch_id: batch_id,
        fetchInstead: fetchInstead,
        htmlVisualizer: htmlVisualizer,
        htmlContained: htmlContained,
      };
      let frameCount = getFrameCount(BATCH_execution);
      let max_parallel_executions = BATCH_execution
        ? MAX_PARALLEL_EXECUTIONS_BATCH
        : MAX_PARALLEL_EXECUTIONS;
      if (frameCount >= max_parallel_executions && !BATCH_execution) {
        Logger.log("Too many iframes on page. Not injecting");
        let dataToBeQueued = {
          url: url,
          recordID: recordID,
          eventData: eventData,
          waitForElement: waitForElement,
          shouldSandbox: shouldSandbox,
          sandBoxAttributes: sandBoxAttributes,
          triggersDownload: triggersDownload,
          skipHeaders: skipHeaders,
          hostname: hostname,
          htmlVisualizer: htmlVisualizer,
          htmlContained: htmlContained,
        };
        await insertInQueue(dataToBeQueued, BATCH_execution);
      } else {
        await proceedWithActivation(
          url,
          recordID,
          eventData,
          waitForElement,
          shouldSandbox,
          sandBoxAttributes,
          BATCH_execution,
          triggersDownload,
          skipHeaders,
          hostname,
          htmlVisualizer,
          htmlContained,
        );
      }
      resolve("done");
    });
  });
}

export async function proceedWithActivation(
  url: string,
  recordID: string,
  eventData: { [key: string]: any },
  waitForElement: string,
  shouldSandbox: boolean,
  sandBoxAttributes: string,
  BATCH_execution: boolean,
  triggerDownload: boolean = false,
  skipHeaders: boolean = false,
  hostname: string = "",
  htmlVisualizer: boolean = false,
  htmlContained: boolean = false,
  breakLoop: boolean = false,
) {
  Logger.log("[proceedWithActivation] => HTML Visualizer: " + htmlVisualizer);
  Logger.log("[proceedWithActivation] => HTML Contained: " + htmlContained);
  if (htmlVisualizer && !breakLoop) {
    Logger.log("[proceedWithActivation] => Sending message to background");
    await sendMessageToBackground({
      intent: "handleHTMLVisualizer",
      url: url,
      recordID: recordID,
      eventData: JSON.stringify(eventData),
      waitForElement: waitForElement,
      shouldSandbox: shouldSandbox,
      sandBoxAttributes: sandBoxAttributes,
      BATCH_execution: BATCH_execution,
      triggerDownload: triggerDownload,
      skipHeaders: skipHeaders,
      hostname: hostname,
    });
  } else if (htmlContained && !breakLoop) {
    await sendMessageToBackground({
      intent: "handleHTMLContained",
      url: url,
      recordID: recordID,
      eventData: JSON.stringify(eventData),
      waitForElement: waitForElement,
      shouldSandbox: shouldSandbox,
      sandBoxAttributes: sandBoxAttributes,
      BATCH_execution: BATCH_execution,
      triggerDownload: triggerDownload,
      skipHeaders: skipHeaders,
      hostname: hostname,
    });
  } else {
    if (triggerDownload) {
      await sendToBackgroundToSeeIfTriggersDownload(url, triggerDownload);
    }
    if (skipHeaders) {
      await disableXFrameHeaders(hostname, skipHeaders);
    }
    setLifespanForIframe(
      recordID,
      parseInt(eventData.waitBeforeScraping),
      BATCH_execution,
    );
    // add listener on window
    let frameReplied = false;
    window.addEventListener("message", (event) => {
      if (event.data.isIframeAlive && event.data.recordID === recordID) {
        frameReplied = true;
      }
    });
    insertIFrame(
      url,
      recordID,
      function () {
        // find a way to send a message to the content script inside this iframe
        // to check if it's ready
        // send message isContentScriptAlive
        let iframe: HTMLIFrameElement | null = document.getElementById(
          recordID,
        ) as HTMLIFrameElement | null;
        if (iframe)
          iframe.contentWindow?.postMessage(
            { isContentScriptAlive: true, recordID: recordID },
            "*",
          );
        if (waitForElement === "none") {
          if (iframe) iframe.contentWindow?.postMessage(eventData, "*");
        }
        setTimeout(() => {
          if (!frameReplied) {
            // SET AS NOT WORKING WEBSITE
            // hit endpoint to save result
            alert("Cannot load " + url);
          }
        }, 1000);
      },
      "800px",
      BATCH_execution ? DATA_ID_IFRAME_BATCH : DATA_ID_IFRAME,
      shouldSandbox,
      sandBoxAttributes,
      htmlVisualizer,
      htmlContained,
    );
    // if waitForElement isn't none, don't
    // wait to load the iframe, but keep
    // sending message until iframe replies.
    if (waitForElement !== "none") {
      let iFrameReplied = false;
      window.addEventListener("message", function (event) {
        if (event.data.isMReply && event.data.recordID === recordID)
          iFrameReplied = true;
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
}
