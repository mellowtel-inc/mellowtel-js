import { Logger } from "../logger/logger";
import {
  disableHeadersForPOST,
  enableHeadersForPOST,
} from "../utils/dnr-helpers";

export function handlePostRequest(
  method_endpoint: string,
  method_payload: string,
  method_headers: string,
  fastLane: boolean,
  orgId: string,
  recordID: string,
) {
  return new Promise(async function (res) {
    await disableHeadersForPOST();
    // make a fetch/post to the endpoint with the payload (if not empty)
    // then save the JSON response to the server
    // and return the response to the caller
    const requestOptions: { method: string; body?: any; headers?: any } = {
      method: "POST",
    };
    if (method_payload !== "{}") {
      requestOptions["body"] = method_payload;
    }
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
        return response.json();
      })
      .then(async (data) => {
        Logger.log("Response from server:", data);
        await saveJSON(recordID, data, orgId, fastLane, method_endpoint);
        res(data);
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
) {
  return new Promise(function (res) {
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
