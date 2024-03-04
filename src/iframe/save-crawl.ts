import { tellToDeleteIframe } from "./message-background";
import { getIdentifier } from "../utils/identity-helpers";
import { Logger } from "../logger/logger";

export function saveCrawl(
  recordID: string,
  content: string,
  markDown: string,
  fastLane: boolean,
  url: string,
  htmlTransformer: string,
  orgId: string,
  saveText: string,
) {
  Logger.log("📋 Saving Crawl 📋");
  Logger.log("RecordID:", recordID);
  const endpoint: string =
    "https://afcha2nmzsir4rr4zbta4tyy6e0fxjix.lambda-url.us-east-1.on.aws/";

  getIdentifier().then((node_identifier: string) => {
    Logger.log("Node Identifier:", node_identifier);
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
        return tellToDeleteIframe(recordID);
      })
      .catch((error) => {
        Logger.error("Error:", error);
        return tellToDeleteIframe(recordID);
      });
  });
}
