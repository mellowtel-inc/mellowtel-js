import { sendMessageToBackground } from "../utils/messaging-helpers";
import { Logger } from "../logger/logger";

export function tellToDeleteIframe(recordID: string, BATCH_execution: boolean) {
  return new Promise((resolve) => {
    Logger.log("[tellToDeleteIframe] : recordID => " + recordID);
    Logger.log("[tellToDeleteIframe] : BATCH_execution => " + BATCH_execution);
    sendMessageToBackground({
      intent: "deleteIframeM",
      recordID: recordID,
      BATCH_execution: BATCH_execution,
    }).then((response) => {
      resolve(response);
    });
  });
}
