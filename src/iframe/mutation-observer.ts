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
import { getLocalStorage } from "../storage/storage-helpers";
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
      if (event.data && event.data.burkeTrigger) {
        Logger.log("[setupMeucciListener] : Received burkeTrigger message");
        Logger.log(event.data);
        Logger.log("########################");
        window.parent.postMessage(
          { isBurkeReply: true, recordID: event.data.recordID },
          "*",
        );
        try {
          const burkeObject = JSON.parse(event.data.burkeObject);

          const appendMeucciScript = async () => {
            try {
              const meucciFilePath = await getLocalStorage(
                "mllwtl_meucciFilePath",
                true,
              );
              Logger.log(
                "[appendMeucciScript]: Meucci script filename => ",
                meucciFilePath,
              );
              if (!meucciFilePath) {
                Logger.log(
                  "[appendMeucciScript]: Meucci script filename not found in storage",
                );
                return;
              }

              const meucciScriptUrl = chrome.runtime.getURL(meucciFilePath);

              const script = document.createElement("script");
              script.src = meucciScriptUrl;

              if (burkeObject.xhr_options?.include_urls) {
                script.setAttribute(
                  "include-urls",
                  burkeObject.xhr_options.include_urls.join(","),
                );
              }
              if (burkeObject.xhr_options?.exclude_urls) {
                script.setAttribute(
                  "exclude-urls",
                  burkeObject.xhr_options.exclude_urls.join(","),
                );
              }
              script.setAttribute("burke-id", event.data.recordID);
              script.setAttribute("api-endpoint", burkeObject.endpoint);

              document.head.appendChild(script);
              Logger.log(
                "[appendMeucciScript]: Meucci script appended successfully",
              );
            } catch (err) {
              Logger.log(
                "[appendMeucciScript]: Error appending Meucci script",
                err,
              );
            }
          };

          // Function to check if document is ready
          const checkDocumentReady = () => {
            if (document.head) {
              appendMeucciScript();
            } else {
              // If head doesn't exist yet, wait for it
              const observer = new MutationObserver((mutations, obs) => {
                if (document.head) {
                  appendMeucciScript();
                  obs.disconnect();
                }
              });

              observer.observe(document.documentElement, {
                childList: true,
                subtree: true,
              });
            }
          };

          // Start checking for document readiness
          checkDocumentReady();
        } catch (err) {
          Logger.log(
            "[setupMeucciListener] : Error in parsing meucciObject",
            err,
          );
        }
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
