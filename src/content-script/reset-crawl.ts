import { getLastFromQueue } from "./queue-crawl";
import {
  DATA_ID_IFRAME,
  LIFESPAN_IFRAME,
  MAX_PARALLEL_EXECUTIONS,
  MAX_PARALLEL_EXECUTIONS_BATCH,
} from "../constants";
import { proceedWithActivation } from "./execute-crawl";
import { getFrameCount } from "../utils/utils";
import { enableXFrameHeaders } from "../dnr/dnr-helpers";
import { Logger } from "../logger/logger";
import { resetTriggersDownload } from "../utils/triggers-download-helpers";
import { hideBadgeIfShould } from "../transparency/badge-settings";
import { deleteFromRequestInfoStorage } from "../request-info/request-info-helpers";

export async function resetAfterCrawl(
  recordID: string,
  BATCH_execution: boolean,
) {
  await deleteFromRequestInfoStorage(recordID);
  let dataPacket = await getLastFromQueue(BATCH_execution);
  Logger.log("[resetAfterCrawl] : dataPacket => ");
  Logger.log(dataPacket);
  Logger.log("##############################");
  if (dataPacket && dataPacket.url !== "") {
    let frameCount = getFrameCount(BATCH_execution);
    Logger.log("[🌐] : frameCount in cleanUpAfterCrawl  => " + frameCount);
    let max_parallel_executions = BATCH_execution
      ? MAX_PARALLEL_EXECUTIONS_BATCH
      : MAX_PARALLEL_EXECUTIONS;
    if (frameCount <= max_parallel_executions || BATCH_execution) {
      Logger.log("[🌐] getLastFromQueue : dataPacket => ");
      Logger.log(dataPacket);
      if (BATCH_execution && dataPacket.methodEndpoint !== "") {
        // wait for 1.5 seconds before proceeding with the next crawl
        setTimeout(() => {
          proceedWithActivation(
            dataPacket.url,
            dataPacket.recordID,
            dataPacket.eventData,
            dataPacket.waitForElement,
            dataPacket.shouldSandbox,
            dataPacket.sandBoxAttributes,
            BATCH_execution,
            dataPacket.batch_id,
            dataPacket.triggerDownload,
            dataPacket.skipHeaders,
            dataPacket.hostname,
            dataPacket.htmlVisualizer,
            dataPacket.htmlContained,
            dataPacket.screenWidth,
            dataPacket.screenHeight,
            dataPacket.POST_request,
            dataPacket.GET_request,
            dataPacket.methodEndpoint,
            dataPacket.methodPayload,
            dataPacket.methodHeaders,
          );
        }, 500);
      } else {
        await proceedWithActivation(
          dataPacket.url,
          dataPacket.recordID,
          dataPacket.eventData,
          dataPacket.waitForElement,
          dataPacket.shouldSandbox,
          dataPacket.sandBoxAttributes,
          BATCH_execution,
          dataPacket.batch_id,
          dataPacket.triggerDownload,
          dataPacket.skipHeaders,
          dataPacket.hostname,
          dataPacket.htmlVisualizer,
          dataPacket.htmlContained,
          dataPacket.screenWidth,
          dataPacket.screenHeight,
          dataPacket.POST_request,
          dataPacket.GET_request,
          dataPacket.methodEndpoint,
          dataPacket.methodPayload,
          dataPacket.methodHeaders,
        );
      }
    }
  } else {
    setTimeout(() => {
      let frameCount = getFrameCount(BATCH_execution);
      let frameCountOther = getFrameCount(!BATCH_execution);
      let frameCountTotal = frameCount + frameCountOther;
      Logger.log(
        "[🌐] : frameCountTotal in cleanUpAfterCrawl (before resetting headers)  => " +
          frameCountTotal,
      );
      if (frameCountTotal === 0 && !BATCH_execution) {
        Logger.log("[🌐] : Resetting headers!");
        enableXFrameHeaders("");
        resetTriggersDownload();
      } else if (frameCountTotal === 0 && BATCH_execution) {
        // wait for 1 minute before resetting headers
        setTimeout(() => {
          Logger.log("[🌐] : Resetting headers (BATCH_execution)!");
          enableXFrameHeaders("");
          resetTriggersDownload();
        }, 60000);
      } /* else {
        resetAfterCrawl(recordID, BATCH_execution);
      }*/
    }, 15000);
  }
}

export function setLifespanForIframe(
  recordID: string,
  waitBeforeScraping: number,
  BATCH_execution: boolean,
) {
  Logger.log(
    "Setting lifespan for iframe => " +
      (LIFESPAN_IFRAME + waitBeforeScraping) +
      " ms. RecordID => " +
      recordID,
  );
  setTimeout(async () => {
    let iframe = document.getElementById(recordID);
    let dataId = iframe?.getAttribute("data-id") || "";
    let divIframe = document.getElementById("div-" + recordID);
    if (iframe) iframe.remove();
    if (divIframe) divIframe.remove();
    await resetAfterCrawl(recordID, BATCH_execution);
    if (dataId === DATA_ID_IFRAME) {
      await hideBadgeIfShould();
    }
  }, LIFESPAN_IFRAME + waitBeforeScraping);
}
