import { getOptInStatus, optOut, optIn } from "../utils/opt-in-out-helpers";
import { getIdentifier } from "../utils/identity-helpers";
import { MELLOWTEL_VERSION } from "../constants";
import { RateLimiter } from "../local-rate-limiting/rate-limiter";
import { Logger } from "../logger/logger";
import { start, stop } from "../utils/start-stop-helpers";

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
      if (request.action === "startMellowtel") {
        start().then(() => {
          sendResponse({ message: "mellowtel-started" });
        });
      }
      if (request.action === "stopMellowtel") {
        stop().then(() => {
          sendResponse({ message: "mellowtel-stopped" });
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
      if (request.action === "closePage") {
        if (
          sender.tab &&
          sender.tab.id !== undefined &&
          sender.tab.url !== undefined
        ) {
          // remove the page which is sending the message only if url includes mellowtel.it or mellow.tel
          if (
            sender.tab.url.includes("mellowtel.it") ||
            sender.tab.url.includes("mellow.tel")
          ) {
            chrome.tabs.remove(sender.tab.id);
            sendResponse({ message: "page-closed" });
          } else {
            sendResponse({ message: "page-not-closed" });
          }
        } else {
          Logger.log("sender.tab or sender.tab.id is undefined");
        }
      }
      return true;
    },
  );
}
