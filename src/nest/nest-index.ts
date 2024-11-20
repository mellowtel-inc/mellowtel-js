import { insertIFrame } from "../utils/iframe-helpers";

export async function initializeNest() {
  let eventDataGlobal;
  let recordIDGlobal;

  window.addEventListener("message", (event) => {
    console.log("Message received in preview.bundle.js");
    console.log(event.data);
    console.log("#################");
    const {
      url,
      id,
      width,
      data_id,
      shouldDisableJS,
      sandBoxAttributes,
      preview,
      waitForElement,
      eventData,
      htmlVisualizer,
      htmlContained,
    } = event.data;

    if (eventData !== undefined) {
      eventDataGlobal = JSON.parse(eventData);
    }
    let recordID = id;
    recordIDGlobal = recordID;

    insertIFrame(
      url,
      id,
      () => {
        if (waitForElement === "none") {
          let iframe = document.getElementById(recordID);
          iframe.contentWindow.postMessage(eventDataGlobal, "*");
        }
      },
      width,
      data_id,
      shouldDisableJS,
      sandBoxAttributes,
      false,
      waitForElement,
      eventDataGlobal,
      htmlVisualizer,
      htmlContained,
    );
  });

  console.log("Preview is running...");
  let iFrameReplied = false;
  // listen for messages from parent (if waitForElementIsNotNone), then reroute to iframe
  window.addEventListener("message", (event) => {
    if (event.data.isOReply) iFrameReplied = true;
    if (event.data.waitForElementIsNotNone) {
      // send message to parent data.isOReply, so it stops trying to reach us
      window.parent.postMessage({ isOReply: true }, "*");
      // Now, send message to iframe.
      // Keep sending until it replies, at which point we stop and relay the message to parent
      let timer = setInterval(function () {
        let iframe = document.getElementById(recordIDGlobal);
        if (iFrameReplied) {
          clearInterval(timer);
          return;
        }
        if (iframe) iframe.contentWindow.postMessage(eventDataGlobal, "*");
      }, 50);
    }
  });
}
