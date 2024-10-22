import { tellToDeleteIframe } from "../message-background";
import { getIdentifier } from "../../utils/identity-helpers";
import { Logger } from "../../logger/logger";
import { getFromRequestInfoStorage } from "../../request-info/request-info-helpers";
import { getFromRequestMessageStorage } from "../../request-message/request-message-helpers";
import { checkIfOpenTabIfMustAndShould } from "./save-utils";

export function saveCrawl(
  recordID: string,
  content: string,
  markDown: string,
  fastLane: boolean,
  url: string,
  htmlTransformer: string,
  orgId: string,
  saveText: string,
  saveHtml: boolean,
  saveMarkdown: boolean,
  BATCH_execution: boolean,
  batch_id: string,
  website_unreachable: boolean = false,
  delayBetweenExecutions: number = 500,
  openTabOnlyIfMust: boolean = false,
) {
  Logger.log("📋 Saving Crawl 📋");
  Logger.log("RecordID:", recordID);

  getIdentifier().then(async (node_identifier: string) => {
    let requestMessageInfo = await getFromRequestMessageStorage(recordID);
    Logger.log("###### Request Message Info ######");
    Logger.log(requestMessageInfo);
    Logger.log("##############################");
    let endpoint: string =
      "https://afcha2nmzsir4rr4zbta4tyy6e0fxjix.lambda-url.us-east-1.on.aws/";
    if (requestMessageInfo && requestMessageInfo.save_html_endpoint) {
      Logger.log(
        "Using save_html_endpoint from requestMessageInfo:",
        requestMessageInfo.save_html_endpoint,
      );
      endpoint = requestMessageInfo.save_html_endpoint;
    }
    Logger.log("Node Identifier:", node_identifier);
    let moreInfo: any = await getFromRequestInfoStorage(recordID);
    Logger.log("[saveCrawl] => More Info:", moreInfo);

    let bodyData: any = {
      // content: content,
      // markDown: markDown,
      recordID: recordID,
      fastLane: fastLane,
      url: url,
      htmlTransformer: htmlTransformer,
      orgId: orgId,
      saveText: saveText,
      node_identifier: node_identifier,
      BATCH_execution: BATCH_execution,
      batch_id: batch_id,
      final_url: window.location.href,
      website_unreachable: website_unreachable,
      statusCode: moreInfo.statusCode,
      requestMessageInfo: requestMessageInfo,
      saveHtml: saveHtml,
      saveMarkdown: saveMarkdown,
    };
    if (saveHtml) {
      bodyData["content"] = content;
    }
    if (saveMarkdown) {
      bodyData["markDown"] = markDown;
    }

    const requestOptions = {
      method: "POST",
      headers: { "Content-Type": "text/plain" },
      body: JSON.stringify(bodyData),
    };

    Logger.log("Sending data to server:", bodyData);

    fetch(endpoint, requestOptions)
      .then((response) => {
        if (!response.ok) {
          throw new Error("Network response was not ok");
        }
        return response.json();
      })
      .then(async (data) => {
        Logger.log("Response from server:", data);
        let message = "";
        if (data.hasOwnProperty("message")) {
          message = data.message;
        }
        tellToDeleteIframe(recordID, BATCH_execution, delayBetweenExecutions);
        // if response contain special instructions and openTabOnlyIfMust is true
        // then open the tab
        await checkIfOpenTabIfMustAndShould(recordID, message);
        return data;
      })
      .catch(async (error) => {
        Logger.error("Error:", error);
        tellToDeleteIframe(recordID, BATCH_execution, delayBetweenExecutions);
        // if response contain special instructions and openTabOnlyIfMust is true
        // then open the tab
        await checkIfOpenTabIfMustAndShould(recordID, "shouldOpen");
        return error;
      });
  });
}
