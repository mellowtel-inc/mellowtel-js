import { sendMessageToBackground } from "../utils/messaging-helpers";

export function tellToDeleteIframe(recordID: string) {
  return new Promise((resolve) => {
    sendMessageToBackground({
      intent: "deleteIframeMellowtel",
      recordID: recordID,
    }).then((response) => {
      resolve(response);
    });
  });
}
