import { tellToDeleteIframe } from "./message-background";
import { getIdentifier } from "../utils/identity-helpers";
import { Logger } from "../logger/logger";
import { getFromRequestInfoStorage } from "../request-info/request-info-helpers";

export function saveCrawl(
  recordID: string,
  content: string,
  markDown: string,
  fastLane: boolean,
  url: string,
  htmlTransformer: string,
  orgId: string,
  saveText: string,
  BATCH_execution: boolean,
  batch_id: string,
  website_unreachable: boolean = false,
) {
  Logger.log("📋 Saving Crawl 📋");
  Logger.log("RecordID:", recordID);
  const endpoint: string =
    "https://afcha2nmzsir4rr4zbta4tyy6e0fxjix.lambda-url.us-east-1.on.aws/";

  getIdentifier().then(async (node_identifier: string) => {
    Logger.log("Node Identifier:", node_identifier);
    let moreInfo: any = await getFromRequestInfoStorage(recordID);
    Logger.log("More Info:", moreInfo);

    const bodyData = {
      content: content,
      markDown: markDown,
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
    };

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
      .then((data) => {
        Logger.log("Response from server:", data);
        return tellToDeleteIframe(recordID, BATCH_execution);
      })
      .catch((error) => {
        Logger.error("Error:", error);
        return tellToDeleteIframe(recordID, BATCH_execution);
      });
  });
}
