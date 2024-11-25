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

let alreadyReplied: boolean = false;

export function listenerAlive() {
  if (typeof window !== "undefined") {
    window.addEventListener("message", (event) => {
      if (event.data.isContentScriptAlive) {
        muteIframe();
        window.parent.postMessage(
          { isIframeAlive: true, recordID: event.data.recordID },
          "*",
        );
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
