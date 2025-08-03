import {
  MAX_PARALLEL_EXECUTIONS,
  MAX_PARALLEL_EXECUTIONS_BATCH,
} from "../constants";
import { insertInQueue } from "./queue-crawl";
import { getFrameCount } from "../utils/utils";
import { Logger } from "../logger/logger";
import { sendMessageToBackground } from "../utils/messaging-helpers";

function fromDataPacketToNecessaryElements(dataPacket: { [key: string]: any }) {
  Logger.log("[fromDPToNElements] => ", dataPacket);
  let fastLane: boolean = dataPacket.hasOwnProperty("fastLane")
    ? dataPacket.fastLane.toString().toLowerCase() === "true"
    : false;
  let orgId: string = dataPacket.hasOwnProperty("orgId")
    ? dataPacket.orgId
    : "";
  let recordID: string = dataPacket.recordID;
  let url: string = dataPacket.url;
  let waitBeforeScraping: number =
    parseInt(dataPacket.waitBeforeScraping) * 1000;
  let saveHtml: boolean = dataPacket.hasOwnProperty("saveHtml")
    ? dataPacket.saveHtml.toString().toLowerCase() === "true"
    : false;
  let saveMarkdown = dataPacket.hasOwnProperty("saveMarkdown")
    ? dataPacket.saveMarkdown.toString().toLowerCase() === "true"
    : false;
  let removeCSSselectors: string = dataPacket.removeCSSselectors;
  let classNamesToBeRemoved: string[] =
    dataPacket.classNamesToBeRemoved !== undefined
      ? JSON.parse(dataPacket.classNamesToBeRemoved)
      : [];
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
  let screenWidth: string = dataPacket.hasOwnProperty("screen_width")
    ? dataPacket.screen_width
    : "1024px";
  let screenHeight: string = dataPacket.hasOwnProperty("screen_height")
    ? dataPacket.screen_height
    : "768px";
  let method: string = dataPacket.hasOwnProperty("method")
    ? dataPacket.method
    : "NONE";
  let POST_request = false;
  let GET_request = false;
  if (method === "POST") {
    POST_request = true;
  }
  if (method === "GET") {
    GET_request = true;
  }
  let methodEndpoint: string = dataPacket.hasOwnProperty("method_endpoint")
    ? dataPacket.method_endpoint
    : "";
  let methodPayload: string = dataPacket.hasOwnProperty("method_payload")
    ? dataPacket.method_payload
    : "no_payload";
  let methodHeaders: string = dataPacket.hasOwnProperty("method_headers")
    ? dataPacket.method_headers
    : "no_headers";
  let actions: string = dataPacket.hasOwnProperty("actions")
    ? dataPacket.actions
    : JSON.stringify([]);
  let openTab: boolean = dataPacket.hasOwnProperty("openTab")
    ? dataPacket.openTab.toString().toLowerCase() === "true"
    : false;
  let openTabOnlyIfMust: boolean = dataPacket.hasOwnProperty(
    "openTabOnlyIfMust",
  )
    ? dataPacket.openTabOnlyIfMust.toString().toLowerCase() === "true"
    : false;
  let pascoli: boolean = dataPacket.hasOwnProperty("pascoli")
    ? dataPacket.pascoli.toString().toLowerCase() === "true"
    : false;
  let cerealObject: string = dataPacket.hasOwnProperty("cerealObject")
    ? dataPacket.cerealObject
    : "{}";
  let refPolicy: string = dataPacket.hasOwnProperty("refPolicy")
    ? dataPacket.refPolicy
    : "";
  let rawData: boolean = dataPacket.hasOwnProperty("rawData")
    ? dataPacket.rawData.toString().toLowerCase() === "true"
    : false;
  let bCrewObject = dataPacket.hasOwnProperty("bCrewObject")
    ? dataPacket.bCrewObject
    : "{}";
  let burkeObject = dataPacket.hasOwnProperty("burkeObject")
    ? dataPacket.burkeObject
    : "{}";
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
    screenWidth,
    screenHeight,
    POST_request,
    GET_request,
    methodEndpoint,
    methodPayload,
    methodHeaders,
    actions,
    openTab,
    openTabOnlyIfMust,
    pascoli,
    cerealObject,
    refPolicy,
    rawData,
    bCrewObject,
    burkeObject,
  };
}

export async function preProcessCrawl(
  dataPacket: { [key: string]: any },
  BATCH_execution: boolean = false,
  batch_id: string = "",
  parallelExecutionsBatch: number = 4,
  delayBetweenExecutions: number = 500, // in ms
) {
  Logger.log("📋 Data Packet 📋");
  Logger.log(dataPacket);
  Logger.log("📋 ----------- 📋");

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
    Logger.log("📋 BATCH_execution 📋");
    dataPacketArray = JSON.parse(dataPacket.batch_array);
    Logger.log("📋 Data Packet Array 📋");
    Logger.log(dataPacketArray);
    Logger.log("📋 ----------- 📋");
    index_to_arrive =
      dataPacketArray.length > parallelExecutionsBatch
        ? parallelExecutionsBatch
        : dataPacketArray.length;
    Logger.log("📋 Index to arrive 📋");
    Logger.log(index_to_arrive);
    Logger.log("📋 ----------- 📋");
  } else {
    dataPacketArray.push(dataPacket);
  }

  for (let i: number = 0; i < index_to_arrive; i++) {
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
      screenWidth,
      screenHeight,
      POST_request,
      GET_request,
      methodEndpoint,
      methodPayload,
      methodHeaders,
      actions,
      openTab,
      openTabOnlyIfMust,
      pascoli,
      cerealObject,
      refPolicy,
      rawData,
      bCrewObject,
      burkeObject,
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
        screenWidth,
        screenHeight,
        POST_request,
        GET_request,
        methodEndpoint,
        methodPayload,
        methodHeaders,
        actions,
        delayBetweenExecutions,
        openTab,
        openTabOnlyIfMust,
        pascoli,
        cerealObject,
        refPolicy,
        rawData,
        bCrewObject,
        burkeObject,
      ),
    );
  }
  if (BATCH_execution) {
    for (let i = index_to_arrive; i < dataPacketArray.length; i++) {
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
        screenWidth,
        screenHeight,
        POST_request,
        GET_request,
        methodEndpoint,
        methodPayload,
        methodHeaders,
        actions,
        openTab,
        openTabOnlyIfMust,
        pascoli,
        cerealObject,
        refPolicy,
        rawData,
        bCrewObject,
        burkeObject,
      } = fromDataPacketToNecessaryElements(dataPacketArray[i]);
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
        screenWidth: screenWidth,
        screenHeight: screenHeight,
        POST_request: POST_request,
        GET_request: GET_request,
        methodEndpoint: methodEndpoint,
        methodPayload: methodPayload,
        methodHeaders: methodHeaders,
        actions: actions,
        delayBetweenExecutions: delayBetweenExecutions,
        openTab: openTab,
        openTabOnlyIfMust: openTabOnlyIfMust,
        pascoli: pascoli,
        cerealObject: cerealObject,
        refPolicy: refPolicy,
        rawData: rawData,
        bCrewObject: bCrewObject,
        burkeObject: burkeObject,
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
        screenWidth: screenWidth,
        screenHeight: screenHeight,
        POST_request: POST_request,
        GET_request: GET_request,
        methodEndpoint: methodEndpoint,
        methodPayload: methodPayload,
        methodHeaders: methodHeaders,
        BATCH_execution: BATCH_execution,
        batch_id: batch_id,
        actions: actions,
        delayBetweenExecutions: delayBetweenExecutions,
        openTab: openTab,
        openTabOnlyIfMust: openTabOnlyIfMust,
        pascoli: pascoli,
        cerealObject: cerealObject,
        refPolicy: refPolicy,
        rawData: rawData,
        bCrewObject: bCrewObject,
        burkeObject: burkeObject,
      };
      Logger.log("📋 Data to be queued 📋");
      Logger.log(dataToBeQueued);
      Logger.log("methodEndpoint: " + methodEndpoint);
      Logger.log("📋 ----------- 📋");
      await insertInQueue(dataToBeQueued, BATCH_execution);
    }
  }
  await Promise.all(promiseArray);
}

export function preProcessUrl(url: string, recordID: string): string[] {
  if (url.startsWith("http://")) url = url.replace("http://", "https://");
  let urlObj = new URL(url);
  let hostname: string = urlObj.hostname;
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
  screenWidth: string = "1024px",
  screenHeight: string = "768px",
  POST_request: boolean = false,
  GET_request: boolean = false,
  methodEndpoint: string = "",
  methodPayload: string = "",
  methodHeaders: string = "",
  actions: string = "",
  delayBetweenExecutions: number = 500,
  openTab: boolean = false,
  openTabOnlyIfMust: boolean = false,
  pascoli: boolean = false,
  cerealObject: string = "{}",
  refPolicy: string = "",
  rawData: boolean = false,
  bCrewObject: string = "{}",
  burkeObject: string = "{}",
): Promise<string> {
  return new Promise(async (resolve) => {
    let [url_to_crawl, hostname] = preProcessUrl(url, recordID);
    Logger.log("[🌐 crawlP2P] : url_to_crawl => " + url_to_crawl);
    Logger.log("[🌐 crawlP2P] : hostname => " + hostname);
    let skipCheck = false;
    if (POST_request || GET_request || openTab) {
      skipHeaders = true;
      skipCheck = true;
    }
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
      screenWidth: screenWidth,
      screenHeight: screenHeight,
      POST_request: POST_request,
      GET_request: GET_request,
      methodEndpoint: methodEndpoint,
      methodPayload: methodPayload,
      methodHeaders: methodHeaders,
      actions: actions,
      delayBetweenExecutions: delayBetweenExecutions,
      openTab: openTab,
      openTabOnlyIfMust: openTabOnlyIfMust,
      pascoli: pascoli,
      cerealObject: cerealObject,
      refPolicy: refPolicy,
      rawData: rawData,
      bCrewObject: bCrewObject,
      burkeObject: burkeObject,
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
        screenWidth: screenWidth,
        screenHeight: screenHeight,
        POST_request: POST_request,
        GET_request: GET_request,
        methodEndpoint: methodEndpoint,
        methodPayload: methodPayload,
        methodHeaders: methodHeaders,
        actions: actions,
        delayBetweenExecutions: delayBetweenExecutions,
        openTab: openTab,
        openTabOnlyIfMust: openTabOnlyIfMust,
        pascoli: pascoli,
        cerealObject: cerealObject,
        refPolicy: refPolicy,
        rawData: rawData,
        bCrewObject: bCrewObject,
        burkeObject: burkeObject,
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
        batch_id,
        triggersDownload,
        skipHeaders,
        hostname,
        htmlVisualizer,
        htmlContained,
        screenWidth,
        screenHeight,
        POST_request,
        GET_request,
        methodEndpoint,
        methodPayload,
        methodHeaders,
        actions,
        delayBetweenExecutions,
        openTab,
        openTabOnlyIfMust,
        pascoli,
        cerealObject,
        refPolicy,
        bCrewObject,
        burkeObject,
      );
    }
    resolve("done");
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
  batch_id: string = "",
  triggersDownload: boolean = false,
  skipHeaders: boolean = false,
  hostname: string = "",
  htmlVisualizer: boolean = false,
  htmlContained: boolean = false,
  screenWidth: string = "1024px",
  screenHeight: string = "768px",
  POST_request: boolean = false,
  GET_request: boolean = false,
  methodEndpoint: string = "",
  methodPayload: string = "",
  methodHeaders: string = "",
  actions: string = "",
  delayBetweenExecutions: number = 500,
  openTab: boolean = false,
  openTabOnlyIfMust: boolean = false,
  pascoli: boolean = false,
  cerealObject: string = "{}",
  refPolicy: string = "",
  bCrewObject: string = "{}",
  burkeObject: string = "{}",
  breakLoop: boolean = false,
) {
  if (GET_request) {
    await sendMessageToBackground({
      intent: "handleGETRequest",
      method_endpoint: methodEndpoint,
      method_headers: methodHeaders,
      fastLane: eventData.fastLane,
      orgId: eventData.orgId,
      recordID: recordID,
      htmlVisualizer: htmlVisualizer,
      htmlContained: htmlContained,
      removeImages: eventData.removeImages,
      removeCSSselectors: eventData.removeCSSselectors,
      classNamesToBeRemoved: JSON.stringify(eventData.classNamesToBeRemoved),
      htmlTransformer: eventData.htmlTransformer,
      BATCH_execution: BATCH_execution,
      batch_id: batch_id,
      actions: actions,
      delayBetweenExecutions: delayBetweenExecutions,
      openTab: openTab,
      openTabOnlyIfMust: openTabOnlyIfMust,
      saveHtml: eventData.saveHtml,
      saveMarkdown: eventData.saveMarkdown,
      cerealObject: cerealObject,
      refPolicy: refPolicy,
      bCrewObject: bCrewObject,
      burkeObject: burkeObject,
    });
  } else if (POST_request) {
    await sendMessageToBackground({
      intent: "handlePOSTRequest",
      method_endpoint: methodEndpoint,
      method_payload: methodPayload,
      method_headers: methodHeaders,
      fastLane: eventData.fastLane,
      orgId: eventData.orgId,
      recordID: recordID,
      htmlVisualizer: htmlVisualizer,
      htmlContained: htmlContained,
      removeImages: eventData.removeImages,
      removeCSSselectors: eventData.removeCSSselectors,
      classNamesToBeRemoved: JSON.stringify(eventData.classNamesToBeRemoved),
      htmlTransformer: eventData.htmlTransformer,
      BATCH_execution: BATCH_execution,
      batch_id: batch_id,
      actions: actions,
      delayBetweenExecutions: delayBetweenExecutions,
      openTab: openTab,
      openTabOnlyIfMust: openTabOnlyIfMust,
      saveHtml: eventData.saveHtml,
      saveMarkdown: eventData.saveMarkdown,
      cerealObject: cerealObject,
      refPolicy: refPolicy,
      bCrewObject: bCrewObject,
      burkeObject: burkeObject,
    });
  }
}
