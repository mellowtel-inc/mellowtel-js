import { Logger } from "../logger/logger";
import {
  disableHeadersForXHR,
  enableHeadersForXHR,
} from "../dnr/dnr-helpers";
import { sendMessageToContentScript } from "../utils/messaging-helpers";
import {
  addToRequestInfoStorage,
  getFromRequestInfoStorage,
} from "../request-info/request-info-helpers";
import { tellToDeleteIframe } from "../iframe/message-background";

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
    await disableHeadersForXHR(method_endpoint);
    try {
      const requestOptions: {
        method: string;
        credentials: RequestCredentials;
        body?: any;
        headers?: any;
      } = {
        method: "POST",
        // we're omitting credentials to avoid leaking cookies & session data
        // this is a security measure to protect the user's data
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
      let statusCode: number = 1000;
      const response = await fetch(method_endpoint, requestOptions);
      statusCode = response.status;
      const html_or_json = await response.text();

      let isJson = false;
      try {
        JSON.parse(html_or_json);
        isJson = true;
      } catch (_) {}

      if (isJson) {
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
        res(html_or_json);
      } else {
        Logger.log("[handlePostRequest]: Not JSON");
        await addToRequestInfoStorage({
          recordID: recordID,
          isPDF: false,
          statusCode: statusCode,
        });
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
              actions: actions,
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
        res(html_or_json);
      }
    } catch (error) {
      Logger.log("Error:", error);
      res(undefined);
    } finally {
      await enableHeadersForXHR(method_endpoint);
    }
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
  statusCode: number,
) {
  return new Promise(async function (res) {
    try {
      const targetUrl: string =
        "https://afcha2nmzsir4rr4zbta4tyy6e0fxjix.lambda-url.us-east-1.on.aws/";
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
          statusCode: statusCode,
        }),
      };
      Logger.log("[saveJSON] : Request options => ");
      Logger.log(requestOptions);
      // DNR cleanup is owned by the outer handlePost/handleGet try/finally.
      // Do not call enableHeadersForPOST here: this fetch is fire-and-forget
      // and we no longer have a URL to derive the per-host rule id from.
      fetch(targetUrl, requestOptions)
        .then(async (response) => {
          if (!response.ok) {
            throw new Error("Network response was not ok");
          }
          return response.json();
        })
        .then((data) => {
          Logger.log("[saveJSON]: Response from server:", data);
        })
        .catch((error) => {
          Logger.log("[saveJSON] : Error:", error);
        });
    } catch (e) {
      Logger.error("[saveJSON] : Error:", e);
    }
  });
}
