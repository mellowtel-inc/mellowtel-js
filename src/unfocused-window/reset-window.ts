import { Logger } from "../logger/logger";
import { LIFESPAN_TAB } from "../constants";
import { resetAfterCrawl } from "../content-script/reset-crawl";

export function setLifespanForWindow(
  windowID: number,
  recordID: string,
  waitBeforeScraping: number,
) {
  Logger.log(
    "[setLifespanForTab] : Setting lifespan for Window => " +
      (LIFESPAN_TAB + waitBeforeScraping) +
      " ms. windowID => " +
      windowID +
      " recordID => " +
      recordID,
  );
  setTimeout(async () => {
    chrome.windows.remove(windowID).then();
    await resetAfterCrawl(recordID, false, 500);
  }, LIFESPAN_TAB + waitBeforeScraping);
}
