import { Logger } from "../logger/logger";
import {
  disableHeadersForPOST,
  enableHeadersForPOST,
} from "../utils/dnr-helpers";
import {sendMessageToContentScript} from "../utils/messaging-helpers";
// import { processCrawl } from "../iframe/init-crawl";

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
    const requestOptions: { method: string; body?: any; headers?: any } = {
      method: "GET",
    };
    if (method_headers !== "{}") {
      try {
        requestOptions["headers"] = JSON.parse(method_headers);
      } catch (e) {}
    }
    fetch(method_endpoint, requestOptions)
      .then((response) => {
        if (!response.ok) {
          throw new Error("Network response was not ok");
        }
        return response.text();
      })
      .then(async (html: string) => {
        Logger.log("HTML from GET:", html);
        // use chrome tabs to query a tab and send a message
        // then save the message to the server
        chrome.tabs.query({}, function (tabs){
          for(let i=0; i<tabs.length; i++){
            if(!tabs[i]?.url?.includes("chrome://")){
              sendMessageToContentScript(tabs[i].id!, {
                intent: "processCrawl",
                recordID: recordID,
                fastLane: fastLane,
                orgId: orgId,
                htmlVisualizer: htmlVisualizer,
                htmlContained: htmlContained,
                html_string: html,
                method_endpoint: method_endpoint
              })
              break;
            }
          }
        });
        /*await processCrawl(
          recordID,
          false,
          new MessageEvent("message", { data: {} }),
          0,
          method_endpoint,
          "none",
          orgId,
          fastLane,
          "false",
          "",
          [],
          document_to_use,
          htmlVisualizer,
          htmlContained,
          false,
        );*/
        await enableHeadersForPOST();
        res(true);
      })
      .catch((error) => {
        Logger.log("Error:", error);
      });
  });
}
