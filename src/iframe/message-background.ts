import { sendMessageToBackground } from "../utils/messaging-helpers";

export function tellToDeleteIframe(recordID: string, BATCH_execution: boolean) {
  return new Promise((resolve) => {
    sendMessageToBackground({
      intent: "deleteIframeMellowtel",
      recordID: recordID,
      BATCH_execution: BATCH_execution,
    }).then((response) => {
      resolve(response);
    });
  });
}
