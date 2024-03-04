import { getLastFromQueue } from "./queue-crawl";
import { LIFESPAN_IFRAME, MAX_PARALLEL_EXECUTIONS } from "../constants";
import { proceedWithActivation } from "./execute-crawl";
import { getFrameCount } from "../utils/utils";
import { enableXFrameHeaders } from "../utils/dnr-helpers";
import { Logger } from "../logger/logger";
import { resetTriggersDownload } from "../utils/triggers-download-helpers";

export async function resetAfterCrawl(recordID: string) {
  let dataPacket = await getLastFromQueue();
  if (dataPacket && dataPacket.url !== "") {
    let frameCount = getFrameCount();
    Logger.log("[🌐] : frameCount in cleanUpAfterCrawl  => " + frameCount);
    if (frameCount <= MAX_PARALLEL_EXECUTIONS) {
      Logger.log("[🌐] getLastFromQueue : dataPacket => ");
      Logger.log(dataPacket);
      proceedWithActivation(
        dataPacket.url,
        dataPacket.recordID,
        dataPacket.eventData,
        dataPacket.waitForElement,
        dataPacket.shouldSandbox,
        dataPacket.sandBoxAttributes,
      );
    }
  } else {
    setTimeout(() => {
      let frameCount = getFrameCount();
      Logger.log(
        "[🌐] : frameCount in cleanUpAfterCrawl (before resetting headers)  => " +
          frameCount,
      );
      if (frameCount === 0) {
        enableXFrameHeaders("");
        resetTriggersDownload();
      }
    }, 15000);
  }
}

export function setLifespanForIframe(
  recordID: string,
  waitBeforeScraping: number,
) {
  Logger.log(
    "Setting lifespan for iframe => " +
      (LIFESPAN_IFRAME + waitBeforeScraping) +
      " ms",
  );
  setTimeout(async () => {
    let iframe = document.getElementById(recordID);
    if (iframe) iframe.remove();
    await resetAfterCrawl(recordID);
  }, LIFESPAN_IFRAME + waitBeforeScraping);
}
