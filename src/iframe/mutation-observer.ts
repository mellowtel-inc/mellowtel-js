import { inIframe } from "../utils/iframe-helpers";
import {
  DynamicSelector,
  getSelectorInfo,
  waitForElementDynamicSelector,
} from "./evaluate-selector";
import { Logger } from "../logger/logger";
import { initCrawl } from "./init-crawl";
import { muteIframe } from "./mute-iframe";
import { executeFunctionIfOrWhenBodyExists } from "../utils/document-body-observer";
import { safeRenderIframe } from "./safe-render";
import { applyDistance } from "../bcrew-two/distance";

let alreadyReplied: boolean = false;

export function listenerAlive() {
  if (typeof window !== "undefined") {
    window.addEventListener("message", async (event) => {
      if (event.data.isContentScriptAlive) {
        muteIframe();
        window.parent.postMessage(
          { isIframeAlive: true, recordID: event.data.recordID },
          "*",
        );
      }
      if (event.data && event.data.intent === "applyDistance") {
        Logger.log(
          "[setupDistanceMessageListener] : Received applyDistance message",
        );
        const { jarData, recordID, parsedBCrewObject, originalUrl } =
          event.data;

        // Call applyDistance which will reload the page
        applyDistance(jarData, recordID, parsedBCrewObject, originalUrl).catch(
          (err) =>
            Logger.error(
              "[setupDistanceMessageListener] : Error in applyDistance",
              err,
            ),
        );
      }
      if (event.data && event.data.type === "FETCH_URL") {
        Logger.log("[Eagle] Received FETCH_URL message:", event.data);
        const { recordID, url, eagleObject } = event.data;

        fetch(url)
          .then((response) => response.text())
          .then((content) => {
            window.parent.postMessage(
              {
                type: "EAGLE_RESPONSE",
                recordID: recordID,
                content: content,
              },
              "*",
            );
          })
          .catch((error) => {
            Logger.error("[Eagle] Error fetching URL:", error);
            window.parent.postMessage(
              {
                type: "EAGLE_RESPONSE",
                recordID: recordID,
                error: error.message,
              },
              "*",
            );
          });
      }
    });
  }
}

export function attachMutationObserver() {
  executeFunctionIfOrWhenBodyExists(() => {
    initIframeListeners();
  });
}

function initIframeListeners() {
  if (typeof window === "undefined") return;
  safeRenderIframe();
  if (inIframe()) {
    window.addEventListener("message", initialEventListener);
  }
}

export async function initialEventListener(event: MessageEvent) {
  let isMCrawl = event.data.isMCrawl;
  if (isMCrawl && !alreadyReplied) {
    window.parent.postMessage(
      { isMReply: true, recordID: event.data.recordID },
      "*",
    );
    alreadyReplied = true;
    let waitForElement = event.data.hasOwnProperty("waitForElement")
      ? event.data.waitForElement
      : "none";
    let waitForElementTime = event.data.hasOwnProperty("waitForElementTime")
      ? parseInt(event.data.waitForElementTime)
      : 0;
    window.removeEventListener("message", initialEventListener);

    if (waitForElement === "none") {
      Logger.log('waitForElement === "none"');
      await initCrawl(event, true);
    } else {
      let safeEvalSelector = getSelectorInfo(waitForElement);
      Logger.log(
        "[initialEventListener] : safeEvalSelector => ",
        safeEvalSelector,
      );
      if (!safeEvalSelector) return;
      waitForElementDynamicSelector(
        safeEvalSelector.dSelectorToUse as DynamicSelector,
        safeEvalSelector.selectorId,
        safeEvalSelector.index,
        80000,
      )
        .then(() => {
          setTimeout(async () => {
            await initCrawl(event, true);
          }, waitForElementTime * 1000);
        })
        .catch(() => {
          Logger.log("[DOM_getter] : waitForElement_ELEMENT => catch");
        });
    }
  }
}
