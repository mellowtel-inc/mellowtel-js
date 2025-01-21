import { insertIFrame } from "../utils/iframe-helpers";
import { Logger } from "../logger/logger";

export async function initializePascoli() {
  Logger.log("[initializePascoli]: Preview is running...");
  let alreadyReplied = false;
  let eventDataGlobal: any;
  let recordIDGlobal: any;

  window.addEventListener("message", async (event) => {
    Logger.log("[initializePascoli] : Message received in pascoli.bundle.js");
    Logger.log(event.data);
    Logger.log("#################");
    const {
      url,
      id,
      data_id,
      should_sandbox,
      sandbox_attributes,
      htmlVisualizer,
      htmlContained,
      screenWidth,
      screenHeight,
      eventData,
      pascoli,
      refPolicy,
    } = event.data;

    if (eventData !== undefined) {
      eventDataGlobal = JSON.parse(eventData);
    }
    let recordID = id;
    recordIDGlobal = recordID;

    await insertIFrame(
      url,
      id,
      () => {
        if (eventDataGlobal.waitForElement === "none") {
          let iframe = document.getElementById(recordID) as HTMLIFrameElement;
          if (iframe) iframe?.contentWindow?.postMessage(eventDataGlobal, "*");
        }
      },
      data_id,
      should_sandbox,
      sandbox_attributes,
      htmlVisualizer,
      htmlContained,
      screenWidth,
      screenHeight,
      eventData,
      false,
      refPolicy,
    );
  });

  // listen for messages from parent (if waitForElementIsNotNone), then reroute to iframe
  window.addEventListener("message", (event: MessageEvent) => {
    if (event.data.isMCrawl) alreadyReplied = true;
    if (event.data.waitForElementIsNotNone) {
      // send message to parent data.isOReply, so it stops trying to reach us
      window.parent.postMessage(
        { isMReply: true, recordID: event.data.recordID },
        "*",
      );
      // Now, send message to iframe.
      // Keep sending until it replies, at which point we stop and relay the message to parent
      let timer = setInterval(function () {
        let iframe = document.getElementById(
          recordIDGlobal,
        ) as HTMLIFrameElement;
        if (alreadyReplied) {
          clearInterval(timer);
          return;
        }
        if (iframe) iframe?.contentWindow?.postMessage(eventDataGlobal, "*");
      }, 50);
    }
  });
}
