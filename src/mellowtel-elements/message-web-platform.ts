import { getOptInStatus, optOut, optIn } from "../utils/opt-in-out-helpers";
import {
  getChromeExtensionIdentifier,
  getIdentifier,
} from "../utils/identity-helpers";
import { MELLOWTEL_VERSION } from "../constants";
import { RateLimiter } from "../local-rate-limiting/rate-limiter";
import { Logger } from "../logger/logger";
import { start, stop } from "../utils/start-stop-helpers";
import { executeFunctionIfOrWhenBodyExists } from "../utils/document-body-observer";
import { sendMessageToBackground } from "../utils/messaging-helpers";

export async function setUpExternalMessageListeners() {
  let current_hostname = window.location.hostname;
  let extension_id_original = await getChromeExtensionIdentifier();
  executeFunctionIfOrWhenBodyExists(async () => {
    if (
      current_hostname.includes("mellowtel.it") ||
      current_hostname.includes("mellow.tel") ||
      current_hostname.includes("mellowtel.dev")
    ) {
      Logger.log(
        "[setUpExternalMessageListeners]: Setting up external message listeners",
      );
      const channelFromSiteToExtension: HTMLInputElement | null =
        document.getElementById(
          "mellowtel-message-from-site-to-extension",
        ) as HTMLInputElement;
      if (channelFromSiteToExtension) {
        channelFromSiteToExtension.addEventListener("change", (event) => {
          const message = JSON.parse(channelFromSiteToExtension.value);
          const message_id = message.id;
          const extension_id_message = message.extension_id;
          Logger.log(
            "[setUpExternalMessageListeners] extension_id_message: ",
            extension_id_message,
          );
          Logger.log(
            "[setUpExternalMessageListeners] extension_id_original: ",
            extension_id_original,
          );
          if (extension_id_message !== extension_id_original) {
            Logger.log("Extension ID does not match");
            return;
          }
          if (message.action === "optIn") {
            optIn().then(() => {
              sendMessageToWebsite({ message: "opted-in", id: message_id });
            });
          }
          if (message.action === "optOut") {
            optOut().then(() => {
              sendMessageToWebsite({ message: "opted-out", id: message_id });
            });
          }
          if (message.action === "startMellowtel") {
            start().then(() => {
              sendMessageToWebsite({
                message: "mellowtel-started",
                id: message_id,
              });
            });
          }
          if (message.action === "stopMellowtel") {
            stop().then(() => {
              sendMessageToWebsite({
                message: "mellowtel-stopped",
                id: message_id,
              });
            });
          }
          if (message.action === "getOptInStatus") {
            getOptInStatus().then((status) => {
              sendMessageToWebsite({
                message: "opt-in-status",
                status: status,
                id: message_id,
              });
            });
          }
          if (message.action === "getNodeId") {
            getIdentifier().then((nodeId) => {
              sendMessageToWebsite({
                message: "node-id",
                nodeId: nodeId,
                id: message_id,
              });
            });
          }
          if (message.action === "getMellowtelVersion") {
            sendMessageToWebsite({
              message: "mellowtel-version",
              version: MELLOWTEL_VERSION,
              id: message_id,
            });
          }
          if (message.action === "getRequestsHandled") {
            RateLimiter.getLifetimeTotalCount().then((requestsHandled) => {
              sendMessageToWebsite({
                message: "requests-handled",
                requestsHandled: requestsHandled,
                id: message_id,
              });
            });
          }
          if (message.action === "getRateLimitData") {
            RateLimiter.getRateLimitData().then((rateLimitData) => {
              sendMessageToWebsite({
                message: "rate-limit-data",
                timestamp: rateLimitData.timestamp,
                count: rateLimitData.count,
                id: message_id,
              });
            });
          }
          if (message.action === "closePage") {
            sendMessageToBackground({ intent: "removeCurrentTab" }).then(
              (tab_id) => {
                Logger.log("[setUpExternalMessageListeners] tab_id: ", tab_id);
                sendMessageToWebsite({
                  message: "page-closed",
                  id: message_id,
                });
              },
            );
          }
        });
      }
    }
  });
}

function sendMessageToWebsite(message: any) {
  const channelFromExtensionToSite: HTMLInputElement | null =
    document.getElementById(
      "mellowtel-message-from-extension-to-site",
    ) as HTMLInputElement;
  if (channelFromExtensionToSite) {
    channelFromExtensionToSite.value = JSON.stringify(message);
  }
}
