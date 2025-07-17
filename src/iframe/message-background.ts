import {
  sendMessageToBackground,
  sendMessageToContentScript,
} from "../utils/messaging-helpers";
import { Logger } from "../logger/logger";
import { isInSW } from "../utils/utils";

export function tellToDeleteIframe(
  recordID: string,
  BATCH_execution: boolean,
  delayBetweenExecutions: number = 500,
  url: string,
) {
  return new Promise(async (resolve) => {
    try {
      Logger.log("[tellToDeleteIframe] : recordID => " + recordID);
      Logger.log(
        "[tellToDeleteIframe] : BATCH_execution => " + BATCH_execution,
      );
      // if in background already, avoid relaying message to background
      // directly call the function
      if (await isInSW()) {
        Logger.log("[tellToDeleteIframe] : isInSW => true");
        chrome.tabs.query({}, async function (tabs) {
          for (let i = 0; i < tabs.length; i++) {
            let response = await sendMessageToContentScript(tabs[i]?.id!, {
              intent: "deleteIframeM",
              recordID: recordID,
              BATCH_execution: BATCH_execution,
              delayBetweenExecutions: delayBetweenExecutions,
              url: url,
            });
            if (response !== null) {
              break;
            }
          }
        });
        resolve(true);
      } else {
        sendMessageToBackground({
          intent: "deleteIframeM",
          recordID: recordID,
          BATCH_execution: BATCH_execution,
          delayBetweenExecutions: delayBetweenExecutions,
          url: url,
        }).then((response) => {
          resolve(response);
        });
      }
    } catch (e) {
      Logger.error("[tellToDeleteIframe] : error => " + e);
      resolve(false);
    }
  });
}
