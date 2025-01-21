import { Logger } from "../logger/logger";
import {
  disableHeadersForPOST,
  enableHeadersForPOST,
} from "../dnr/dnr-helpers";
import { sendMessageToContentScript } from "../utils/messaging-helpers";
import { saveJSON } from "../post-requests/post-helpers";
import { addToRequestInfoStorage } from "../request-info/request-info-helpers";
import { tellToDeleteIframe } from "../iframe/message-background";

export function handleGetRequest(
  method_endpoint: string,
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
  actions: string,
  delayBetweenExecutions: number = 500,
  openTab: boolean = false,
  openTabOnlyIfMust: boolean = false,
  saveHtml: boolean = true,
  saveMarkdown: boolean = true,
  cerealObject: string = "{}",
  refPolicy: string = "",
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
      method: "GET",
      // we're omitting credentials to avoid leaking cookies & session data
      // this is a security measure to protect the user's data
      credentials: "omit",
    };
    if (method_headers !== "no_headers") {
      try {
        method_headers = JSON.parse(method_headers);
        requestOptions["headers"] = method_headers;
      } catch (e) {}
    }
    let statusCode: number = 1000;
    fetch(method_endpoint, requestOptions)
      .then((response) => {
        statusCode = response.status;
        return response.text();
      })
      .then(async (html_or_json: string) => {
        // could be json or html
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
            statusCode,
          );
          await tellToDeleteIframe(
            recordID,
            BATCH_execution,
            delayBetweenExecutions,
          );
        } catch (_) {
          Logger.log("[handleGetRequest]: Not JSON");
          Logger.log(
            "[handleGetRequest]: HTML:",
            html_or_json.substring(0, 140),
          );
          Logger.log("[handleGetRequest]: BATCH_execution:", BATCH_execution);
          Logger.log("[handleGetRequest]: batch_id:", batch_id);
          await addToRequestInfoStorage({
            recordID: recordID,
            isPDF: false,
            isOfficeDoc: false,
            statusCode: statusCode,
          });
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
                statusCode: statusCode,
                delayBetweenExecutions: delayBetweenExecutions,
                openTab: openTab,
                openTabOnlyIfMust: openTabOnlyIfMust,
                saveHtml: saveHtml,
                saveMarkdown: saveMarkdown,
                cerealObject: cerealObject,
              });
              if (response !== null) {
                break;
              }
            }
          });
        }
        await enableHeadersForPOST();
        res(true);
      })
      .catch((error) => {
        Logger.log("Error:", error);
      });
  });
}
