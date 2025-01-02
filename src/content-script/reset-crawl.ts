import { getLastFromQueue } from "./queue-crawl";
import {
  DATA_ID_IFRAME,
  LIFESPAN_IFRAME,
  MAX_PARALLEL_EXECUTIONS,
  MAX_PARALLEL_EXECUTIONS_BATCH,
} from "../constants";
import { proceedWithActivation } from "./execute-crawl";
import { getFrameCount, isInSW } from "../utils/utils";
import { enableXFrameHeaders } from "../dnr/dnr-helpers";
import { Logger } from "../logger/logger";
import { resetTriggersDownload } from "../utils/triggers-download-helpers";
import { hideBadgeIfShould } from "../transparency/badge-settings";
import { deleteFromRequestInfoStorage } from "../request-info/request-info-helpers";
import { deleteFromRequestMessageStorage } from "../request-message/request-message-helpers";
import { sendMessageToContentScript } from "../utils/messaging-helpers";
import { waitForResetInterval } from "../utils/trigger-storage";

export async function resetAfterCrawl(
  recordID: string,
  BATCH_execution: boolean,
  delayBetweenExecutions: number = 500,
) {
  return new Promise(async (resolve) => {
    if (await isInSW()) {
      Logger.log(
        "[resetAfterCrawl] : In service worker. Sending message to content script",
      );
      chrome.tabs.query({}, async function (tabs) {
        for (let i = 0; i < tabs.length; i++) {
          let response = await sendMessageToContentScript(tabs[i]?.id!, {
            intent: "resetAfterCrawl",
            recordID: recordID,
            BATCH_execution: BATCH_execution,
            delayBetweenExecutions: delayBetweenExecutions,
          });
          if (response !== null) {
            break;
          }
        }
      });
      resolve("done");
    } else {
      if (
        delayBetweenExecutions === undefined ||
        delayBetweenExecutions === null
      ) {
        Logger.log(
          "[resetAfterCrawl] : delayBetweenExecutions is undefined or null. Setting it to 500",
        );
        delayBetweenExecutions = 500;
      }
      await deleteFromRequestInfoStorage(recordID);
      await deleteFromRequestMessageStorage(recordID);
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
            Logger.log(
              "[🌐] : Waiting for delayBetweenExecutions => " +
                delayBetweenExecutions,
            );
            // if fetching during batch execution, wait delayBetweenExecutions before proceeding
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
                dataPacket.triggersDownload,
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
                dataPacket.actions,
                dataPacket.delayBetweenExecutions,
                dataPacket.openTab,
                dataPacket.openTabOnlyIfMust,
                dataPacket.pascoli,
                dataPacket.refPolicy,
              );
              resolve("done");
            }, delayBetweenExecutions);
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
              dataPacket.triggersDownload,
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
              dataPacket.actions,
              dataPacket.delayBetweenExecutions,
              dataPacket.openTab,
              dataPacket.openTabOnlyIfMust,
              dataPacket.pascoli,
              dataPacket.refPolicy,
            );
            resolve("done");
          }
        } else {
          resolve("done");
        }
      } else {
        setTimeout(async () => {
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
            Logger.log("[🌐] : Waiting for minimum reset interval...");
            await waitForResetInterval();
            Logger.log("[🌐] : Resetting headers!");
            resetTriggersDownload();
            resolve("done");
          } else if (frameCountTotal === 0 && BATCH_execution) {
            // wait for 1 minute before resetting headers
            setTimeout(async () => {
              Logger.log("[🌐] : Resetting headers (BATCH_execution)!");
              enableXFrameHeaders("");
              Logger.log("[🌐] : Waiting for minimum reset interval...");
              await waitForResetInterval();
              Logger.log("[🌐] : Resetting headers!");
              resetTriggersDownload();
              resolve("done");
            }, 60000);
          } /* else {
        resetAfterCrawl(recordID, BATCH_execution);
      }*/
        }, 15000);
      }
    }
  });
}

export function setLifespanForIframe(
  recordID: string,
  waitBeforeScraping: number,
  BATCH_execution: boolean,
  delayBetweenExecutions: number = 500,
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
    await resetAfterCrawl(recordID, BATCH_execution, delayBetweenExecutions);
    if (dataId === DATA_ID_IFRAME) {
      await hideBadgeIfShould();
    }
  }, LIFESPAN_IFRAME + waitBeforeScraping);
}
