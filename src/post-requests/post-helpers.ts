import { Logger } from "../logger/logger";
import {
  disableHeadersForPOST,
  enableHeadersForPOST,
} from "../dnr/dnr-helpers";
import { sendMessageToContentScript } from "../utils/messaging-helpers";
import { getFromRequestInfoStorage } from "../request-info/request-info-helpers";

export function handlePostRequest(
  method_endpoint: string,
  method_payload: string,
  method_headers: string,
  fastLane: boolean,
  orgId: string,
  recordID: string,
  htmlVisualizer: boolean,
  htmlContained: boolean,
  removeImages: boolean,
  removeCSSselectors: string,
  classNamesToBeRemoved: string,
  htmlTransformer: string,
  BATCH_execution: boolean,
  batch_id: string,
) {
  return new Promise(async function (res) {
    await disableHeadersForPOST();
    // make a fetch/post to the endpoint with the payload (if not empty)
    // then save the JSON response to the server
    // and return the response to the caller
    const requestOptions: {
      method: string;
      credentials: RequestCredentials;
      body?: any;
      headers?: any;
    } = {
      method: "POST",
      credentials: "omit",
    };
    if (method_payload !== "no_payload") {
      try {
        method_payload = JSON.parse(method_payload);
        requestOptions["body"] = JSON.stringify(method_payload);
      } catch (e) {}
    }
    if (method_headers !== "no_headers") {
      try {
        method_headers = JSON.parse(method_headers);
        requestOptions["headers"] = method_headers;
      } catch (e) {}
    }
    fetch(method_endpoint, requestOptions)
      .then((response) => {
        return response.text();
      })
      .then(async (html_or_json: string) => {
        // Logger.log("HTML or JSON:", html_or_json);
        try {
          JSON.parse(html_or_json);
          await saveJSON(
            recordID,
            JSON.parse(html_or_json),
            orgId,
            fastLane,
            method_endpoint,
            BATCH_execution,
            batch_id,
          );
          res(html_or_json);
        } catch (_) {
          Logger.log("Not JSON");
          // not json
          // query a tab and send a message
          // then save the message to the server
          chrome.tabs.query({}, async function (tabs) {
            for (let i = 0; i < tabs.length; i++) {
              let response = await sendMessageToContentScript(tabs[i].id!, {
                intent: "processCrawl",
                recordID: recordID,
                fastLane: fastLane,
                orgId: orgId,
                htmlVisualizer: htmlVisualizer,
                htmlContained: htmlContained,
                html_string: html_or_json,
                method_endpoint: method_endpoint,
                removeImages: removeImages,
                removeCSSselectors: removeCSSselectors,
                classNamesToBeRemoved: classNamesToBeRemoved,
                htmlTransformer: htmlTransformer,
                BATCH_execution: BATCH_execution,
                batch_id: batch_id,
              });
              if (response !== null) {
                break;
              }
            }
          });
        }
      })
      .catch((error) => {
        Logger.log("Error:", error);
      });
  });
}

export async function saveJSON(
  recordID: string,
  json: any,
  orgId: string,
  fastLane: boolean,
  endpoint: string,
  BATCH_execution: boolean,
  batch_id: string,
) {
  return new Promise(async function (res) {
    const targetUrl: string =
      "https://afcha2nmzsir4rr4zbta4tyy6e0fxjix.lambda-url.us-east-1.on.aws/";
    let moreInfo: any = await getFromRequestInfoStorage(recordID);
    const requestOptions = {
      method: "POST",
      headers: {
        "Content-Type": "text/plain",
      },
      body: JSON.stringify({
        recordID: recordID,
        json: JSON.stringify(json),
        fastLane: fastLane,
        url: endpoint,
        htmlTransformer: "none",
        orgId: orgId,
        saveText: false,
        BATCH_execution: BATCH_execution,
        batch_id: batch_id,
        statusCode: moreInfo.statusCode,
      }),
    };
    Logger.log("Request options => ");
    Logger.log(requestOptions);
    fetch(targetUrl, requestOptions)
      .then(async (response) => {
        if (!response.ok) {
          await enableHeadersForPOST();
          throw new Error("Network response was not ok");
        }
        return response.json();
      })
      .then(async (data) => {
        Logger.log("Response from server:", data);
        await enableHeadersForPOST();
      })
      .catch(async (error) => {
        Logger.log("Error:", error);
        await enableHeadersForPOST();
      });
  });
}
