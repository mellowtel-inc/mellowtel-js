import { tellToDeleteIframe } from "../message-background";
import { getIdentifier } from "../../utils/identity-helpers";
import { Logger } from "../../logger/logger";
import { sendMessageToBackground } from "../../utils/messaging-helpers";
import {
  checkThroughFilters,
  getS3SignedUrls,
} from "../contained-visualizer-helpers";
import { capture, OutputType } from "../../htmlVisualizer/src";
import { getFromRequestInfoStorage } from "../../request-info/request-info-helpers";
import { getFromRequestMessageStorage } from "../../request-message/request-message-helpers";
import { getFinalUrl } from "../../utils/utils";

async function tellEC2ToRender(
  recordID: string,
  url: string,
  htmlTransformer: string,
  orgId: string,
  delayBetweenExecutions: number = 500,
) {
  Logger.log("📋 tellEC2ToRender - Rendering 📋");
  Logger.log("RecordID:", recordID);
  Logger.log("URL:", url);
  Logger.log("HTML Transformer:", htmlTransformer);
  Logger.log("OrgID:", orgId);
  Logger.log("Delay Between Executions:", delayBetweenExecutions);

  getIdentifier().then(async (node_identifier: string) => {
    let endpoint: string =
      "https://mjkrxoav2cqz3dtgn6ttcyxeua0mqpul.lambda-url.us-east-1.on.aws/";
    let requestMessageInfo = await getFromRequestMessageStorage(recordID);
    if (requestMessageInfo && requestMessageInfo.ec2_render_endpoint) {
      Logger.log(
        "Using ec2_render_endpoint from requestMessageInfo:",
        requestMessageInfo.ec2_render_endpoint,
      );
      endpoint = requestMessageInfo.ec2_render_endpoint;
    }

    let moreInfo: any = await getFromRequestInfoStorage(recordID);
    Logger.log("[tellEC2ToRender] => More Info:", moreInfo);
    const bodyData = {
      recordID: recordID,
      url: url,
      htmlTransformer: htmlTransformer,
      orgId: orgId,
      node_identifier: node_identifier,
      final_url: getFinalUrl(),
      statusCode: moreInfo.statusCode,
    };

    const requestOptions = {
      method: "POST",
      headers: { "Content-Type": "text/plain" },
      body: JSON.stringify(bodyData),
    };

    fetch(endpoint, requestOptions)
      .then((response) => {
        if (!response.ok) {
          throw new Error("[tellEC2ToRender]:Network response was not ok");
        }
        return response.json();
      })
      .then((data) => {
        Logger.log("[tellEC2ToRender]: Response from server:", data);
        return tellToDeleteIframe(recordID, false, delayBetweenExecutions, url);
      })
      .catch((error) => {
        Logger.error("[tellEC2ToRender]: Error:", error);
        return tellToDeleteIframe(recordID, false, delayBetweenExecutions, url);
      });
  });
}

export async function saveWithContained(
  recordID: string,
  content: string,
  markDown: string,
  url: string,
  htmlTransformer: string,
  orgId: string,
  second_document_string: string,
  not_in_iframe: boolean = false,
  delayBetweenExecutions: number = 500,
  openTabOnlyIfMust: boolean = false,
) {
  Logger.log("📋  saveWithContained - Saving Crawl 📋. RecordID:", recordID);
  // first pass through filters
  let isValid = await checkThroughFilters(url, second_document_string, orgId);
  if (!isValid) {
    Logger.log("URL did not pass through filters");
    return tellToDeleteIframe(recordID, false, delayBetweenExecutions, url);
  }
  let signedUrls = await getS3SignedUrls(recordID);
  let htmlContainedURL = signedUrls.uploadURL_html_contained;
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

  // after that, attempt to visualize the HTML
  await sendMessageToBackground({
    intent: "fixImageRenderHTMLVisualizer",
  });

  Logger.log("Attempting to visualize CONTAINED HTML...");
  Logger.log("##########################################");
  // before capturing, scroll down 5 times, smoothly
  if (!not_in_iframe) {
    for (let i = 0; i < 5; i++) {
      window.scrollTo({
        top: window.innerHeight * i,
        behavior: "smooth",
      });
    }
    // scroll to top and capture
    for (let i = 0; i < 5; i++) {
      window.scrollTo({
        top: 0,
        behavior: "smooth",
      });
    }
  }

  const capturedHtml = capture(OutputType.STRING, window.document);
  Logger.log(capturedHtml);
  Logger.log("##########################################");

  await sendMessageToBackground({
    intent: "putHTMLContainedToSigned",
    htmlContainedURL_signed: htmlContainedURL,
    htmlContainedString: not_in_iframe ? content : capturedHtml,
  });
  await sendMessageToBackground({
    intent: "resetImageRenderHTMLVisualizer",
  });
  await tellEC2ToRender(
    recordID,
    url,
    htmlTransformer,
    orgId,
    delayBetweenExecutions,
  );
}
