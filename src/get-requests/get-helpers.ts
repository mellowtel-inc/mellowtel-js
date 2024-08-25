import { Logger } from "../logger/logger";
import {
  disableHeadersForPOST,
  enableHeadersForPOST,
} from "../utils/dnr-helpers";
import { sendMessageToContentScript } from "../utils/messaging-helpers";
import { saveJSON } from "../post-requests/post-helpers";

export function handleGetRequest(
  method_endpoint: string,
  method_headers: string,
  fastLane: boolean,
  orgId: string,
  recordID: string,
  htmlVisualizer: boolean,
  htmlContained: boolean,
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
      credentials: "omit",
    };
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
        // could be json or html
        Logger.log("HTML or JSON:", html_or_json);
        try {
          JSON.parse(html_or_json);
          await saveJSON(
            recordID,
            JSON.parse(html_or_json),
            orgId,
            fastLane,
            method_endpoint,
          );
        } catch (_) {
          Logger.log("Not JSON");
          // not json
          // use chrome tabs to query a tab and send a message
          // then save the message to the server
          chrome.tabs.query({}, function (tabs) {
            for (let i = 0; i < tabs.length; i++) {
              if (!tabs[i]?.url?.includes("chrome://")) {
                // todo: remove this check as if "tabs" permission is not granted, this will not work
                // also, not only limited to chrome://, also other browser specific pages
                sendMessageToContentScript(tabs[i].id!, {
                  intent: "processCrawl",
                  recordID: recordID,
                  fastLane: fastLane,
                  orgId: orgId,
                  htmlVisualizer: htmlVisualizer,
                  htmlContained: htmlContained,
                  html_string: html_or_json,
                  method_endpoint: method_endpoint,
                });
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
