import { getOptInStatus, optOut, optIn } from "../utils/opt-in-out-helpers";
import { getIdentifier } from "../utils/identity-helpers";
import { MELLOWTEL_VERSION } from "../constants";
import { RateLimiter } from "../local-rate-limiting/rate-limiter";

export async function setUpExternalMessageListeners() {
  chrome.runtime.onMessageExternal.addListener(
    (request, sender, sendResponse) => {
      if (request.action === "optIn") {
        optIn().then(() => {
          sendResponse({ message: "opted-in" });
        });
      }
      if (request.action === "optOut") {
        optOut().then(() => {
          sendResponse({ message: "opted-out" });
        });
      }
      if (request.action === "getOptInStatus") {
        getOptInStatus().then((status) => {
          sendResponse({ message: "opt-in-status", status: status });
        });
      }
      if (request.action === "getNodeId") {
        getIdentifier().then((nodeId) => {
          sendResponse({ message: "node-id", nodeId: nodeId });
        });
      }
      if (request.action === "getMellowtelVersion") {
        sendResponse({
          message: "mellowtel version",
          version: MELLOWTEL_VERSION,
        });
      }
      if (request.action === "getRequestsHandled") {
        RateLimiter.getLifetimeTotalCount().then((requestsHandled) => {
          sendResponse({
            message: "requests-handled",
            requestsHandled: requestsHandled,
          });
        });
      }
      if (request.action === "getRateLimitData") {
        RateLimiter.getRateLimitData().then((rateLimitData) => {
          sendResponse({
            message: "rate-limit-data",
            timestamp: rateLimitData.timestamp,
            count: rateLimitData.count,
          });
        });
      }
      return true;
    },
  );
}
