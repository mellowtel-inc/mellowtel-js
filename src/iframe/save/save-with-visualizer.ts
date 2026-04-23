import { tellToDeleteIframe } from "../message-background";
import { getIdentifier } from "../../utils/identity-helpers";
import { Logger } from "../../logger/logger";
import { htmlVisualizer } from "../../htmlVisualizer/htmlVisualizer";
import { sendMessageToBackground } from "../../utils/messaging-helpers";
import {
  checkThroughFilters,
  getS3SignedUrls,
} from "../contained-visualizer-helpers";
import { getFromRequestInfoStorage } from "../../request-info/request-info-helpers";
import { getFromRequestMessageStorage } from "../../request-message/request-message-helpers";

let htmlVisualizerTimedOut: boolean = true;

async function updateDynamo(
  recordID: string,
  url: string,
  htmlTransformer: string,
  orgId: string,
  htmlKey: string = "--",
  markdownKey: string = "--",
  htmlVisualizerKey: string = "--",
  delayBetweenExecutions: number = 500,
) {
  Logger.log("📋  updateDynamo - Saving Crawl 📋");
  Logger.log("RecordID:", recordID);
  Logger.log("URL:", url);
  Logger.log("HTML Transformer:", htmlTransformer);
  Logger.log("OrgID:", orgId);
  Logger.log("HTML Key:", htmlKey);
  Logger.log("Markdown Key:", markdownKey);
  Logger.log("HTML Visualizer Key:", htmlVisualizerKey);
  Logger.log("Delay Between Executions:", delayBetweenExecutions);

  getIdentifier().then(async (device_identifier: string) => {
    let endpoint: string =
      "https://zuaq4uywadlj75qqkfns3bmoom0xpaiz.lambda-url.us-east-1.on.aws/";
    let requestMessageInfo = await getFromRequestMessageStorage(recordID);
    if (requestMessageInfo && requestMessageInfo.update_dynamo_endpoint) {
      Logger.log(
        "Using update_dynamo_endpoint from requestMessageInfo:",
        requestMessageInfo.update_dynamo_endpoint,
      );
      endpoint = requestMessageInfo.update_dynamo_endpoint;
    }

    Logger.log("Device Identifier:", device_identifier);
    let moreInfo: any = await getFromRequestInfoStorage(recordID);
    Logger.log("[updateDynamo] => More Info:", moreInfo);
    const bodyData = {
      recordID: recordID,
      url: url,
      htmlTransformer: htmlTransformer,
      orgId: orgId,
      device_identifier: device_identifier,
      final_url: window.location.href,
      htmlFileName: htmlKey,
      markdownFileName: markdownKey,
      htmlVisualizerFileName: htmlVisualizerKey,
      statusCode: moreInfo.statusCode,
      requestMessageInfo: requestMessageInfo,
    };

    const requestOptions = {
      method: "POST",
      headers: { "Content-Type": "text/plain" },
      body: JSON.stringify(bodyData),
    };

    Logger.log("[updateDynamo]: Sending data to server =>");
    Logger.log(bodyData);

    fetch(endpoint, requestOptions)
      .then((response) => {
        if (!response.ok) {
          throw new Error("Network response was not ok");
        }
        return response.json();
      })
      .then((data) => {
        Logger.log("Response from server:", data);
        return tellToDeleteIframe(recordID, false, delayBetweenExecutions);
      })
      .catch((error) => {
        Logger.error("Error:", error);
        return tellToDeleteIframe(recordID, false, delayBetweenExecutions);
      });
  });
}

export async function saveWithVisualizer(
  recordID: string,
  content: string,
  markDown: string,
  url: string,
  htmlTransformer: string,
  orgId: string,
  second_document_string: string,
  delayBetweenExecutions: number = 500,
  openTabOnlyIfMust: boolean = false,
) {
  Logger.log("📋  saveWithVisualizer - Saving Crawl 📋");
  Logger.log("RecordID:", recordID);
  // first pass through filters
  let isValid = await checkThroughFilters(url, second_document_string, orgId);
  if (!isValid) {
    Logger.log("URL did not pass through filters");
    return tellToDeleteIframe(recordID, false);
  }
  let signedUrls = await getS3SignedUrls(recordID);
  let htmlVisualizerURL = signedUrls.uploadURL_htmlVisualizer;
  let htmlURL = signedUrls.uploadURL_html;
  let markDownURL = signedUrls.uploadURL_markDown;

  await sendMessageToBackground({
    intent: "putHTMLToSigned",
    htmlURL_signed: htmlURL,
    content: content,
  });
  await sendMessageToBackground({
    intent: "putMarkdownToSigned",
    markdownURL_signed: markDownURL,
    markDown: markDown,
  });

  setTimeout(async () => {
    if (htmlVisualizerTimedOut) {
      Logger.error("HTML Visualizer Timed Out");
      // still save what savable
      await updateDynamo(
        recordID,
        url,
        htmlTransformer,
        orgId,
        "text_" + recordID + ".txt",
        "markDown_" + recordID + ".txt",
      );
      return tellToDeleteIframe(recordID, false, delayBetweenExecutions);
    } else {
      Logger.log("HTML Visualizer Completed Correctly");
      htmlVisualizerTimedOut = true;
    }
  }, 20000);

  // after that, attempt to visualize the HTML
  Logger.log("Attempting to visualize HTML...");

  await sendMessageToBackground({
    intent: "fixImageRenderHTMLVisualizer",
  });
  // window.scrollTo(0, 0);
  let base64image = await htmlVisualizer(document.body, {
    useCORS: true,
    // allowTaint: true,
    logging: false,
  })
    .then(function (canvas: HTMLCanvasElement | null) {
      Logger.log("IMAGE IS HERE");
      if (!canvas) return "";
      return canvas.toDataURL("image/png");
    })
    .catch(async function (error: any) {
      // here retry by allowingTaint to be false
      Logger.error("[SCRIPT IS] : ERROR => ", error);
    });
  Logger.log(base64image);

  await sendMessageToBackground({
    intent: "putHTMLVisualizerToSigned",
    htmlVisualizerURL_signed: htmlVisualizerURL,
    base64image: base64image,
  });
  await sendMessageToBackground({
    intent: "resetImageRenderHTMLVisualizer",
  });
  await updateDynamo(
    recordID,
    url,
    htmlTransformer,
    orgId,
    "text_" + recordID + ".txt",
    "markDown_" + recordID + ".txt",
    "image_" + recordID + ".png",
    delayBetweenExecutions,
  );
  htmlVisualizerTimedOut = false;
}
