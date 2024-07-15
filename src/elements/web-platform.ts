import { getOptInStatus, optOut, optIn } from "../utils/opt-in-out-helpers";
import {
  getExtensionIdentifier,
  getExtensionName,
  getIdentifier,
} from "../utils/identity-helpers";
import { VERSION } from "../constants";
import { RateLimiter } from "../local-rate-limiting/rate-limiter";
import { Logger } from "../logger/logger";
import { start, stop } from "../utils/start-stop-helpers";
import { executeFunctionIfOrWhenBodyExists } from "../utils/document-body-observer";
import { sendMessageToBackground } from "../utils/messaging-helpers";
import { generateSettingsLink } from "./generate-links";
import {
  setShouldShowBadge,
  shouldShowBadge,
  unsetShouldShowBadge,
} from "../transparency/badge-settings";

export function createMessagingChannels(extension_id: string) {
  const channelFromExtensionToSite: HTMLInputElement =
    document.createElement("input");
  const channelFromSiteToExtension: HTMLInputElement =
    document.createElement("input");
  channelFromExtensionToSite.id = `message-from-extension-to-site-${extension_id}`;
  channelFromExtensionToSite.style.display = "none";
  channelFromSiteToExtension.id = `message-from-site-to-extension-${extension_id}`;
  channelFromSiteToExtension.style.display = "none";
  document.body.appendChild(channelFromExtensionToSite);
  document.body.appendChild(channelFromSiteToExtension);
}

export async function setUpExternalMessageListeners() {
  let current_hostname = window.location.hostname;
  let extension_id_original = await getExtensionIdentifier();
  executeFunctionIfOrWhenBodyExists(async () => {
    if (
      current_hostname.includes("mellow.tel")
    ) {
      Logger.log(
        "[setUpExternalMessageListeners]: Setting up external message listeners",
      );
      createMessagingChannels(extension_id_original);

      const channelFromSiteToExtension: HTMLInputElement =
        document.getElementById(
          `message-from-site-to-extension-${extension_id_original}`,
        ) as HTMLInputElement;

      if (channelFromSiteToExtension) {
        channelFromSiteToExtension.addEventListener("change", async (event) => {
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
              sendMessageToWebsite(
                { message: "opted-in", id: message_id },
                extension_id_original,
              );
            });
          }
          if (message.action === "optOut") {
            optOut().then(() => {
              sendMessageToWebsite(
                { message: "opted-out", id: message_id },
                extension_id_original,
              );
            });
          }
          if (message.action === "start") {
            start().then(() => {
              sendMessageToWebsite(
                {
                  message: "started",
                  id: message_id,
                },
                extension_id_original,
              );
            });
          }
          if (message.action === "stop") {
            stop().then(() => {
              sendMessageToWebsite(
                {
                  message: "stopped",
                  id: message_id,
                },
                extension_id_original,
              );
            });
          }
          if (message.action === "getOptInStatus") {
            getOptInStatus().then((status) => {
              sendMessageToWebsite(
                {
                  message: "opt-in-status",
                  status: status,
                  id: message_id,
                },
                extension_id_original,
              );
            });
          }
          if (message.action === "getNodeId") {
            getIdentifier().then((nodeId) => {
              sendMessageToWebsite(
                {
                  message: "node-id",
                  nodeId: nodeId,
                  id: message_id,
                },
                extension_id_original,
              );
            });
          }
          if (message.action === "getVersion") {
            sendMessageToWebsite(
              {
                message: "version",
                version: VERSION,
                id: message_id,
              },
              extension_id_original,
            );
          }
          if (message.action === "getRequestsHandled") {
            RateLimiter.getLifetimeTotalCount().then((requestsHandled) => {
              sendMessageToWebsite(
                {
                  message: "requests-handled",
                  requestsHandled: requestsHandled,
                  id: message_id,
                },
                extension_id_original,
              );
            });
          }
          if (message.action === "getRateLimitData") {
            RateLimiter.checkRateLimit(false).then((rateLimitData) => {
              sendMessageToWebsite(
                {
                  message: "rate-limit-data",
                  requestsCount: rateLimitData.requestsCount,
                  id: message_id,
                },
                extension_id_original,
              );
            });
          }
          if (message.action === "closePage") {
            sendMessageToBackground({ intent: "removeCurrentTab" }).then(
              (tab_id) => {
                Logger.log("[setUpExternalMessageListeners] tab_id: ", tab_id);
                sendMessageToWebsite(
                  {
                    message: "page-closed",
                    id: message_id,
                  },
                  extension_id_original,
                );
              },
            );
          }
          if (message.action === "getIfCurrentlyActive") {
            getIfCurrentlyActive().then((currentlyActive: boolean) => {
              sendMessageToWebsite(
                {
                  message: "currently-active",
                  currentlyActive: currentlyActive,
                  id: message_id,
                },
                extension_id_original,
              );
            });
          }
          if (message.action === "getInfoToDisplayInTable") {
            let currentlyActive: boolean = await getIfCurrentlyActive();
            let settingsLink: string = await generateSettingsLink();
            let optInStatus: boolean = await getOptInStatus();
            let extensionId: string = await getExtensionIdentifier();
            let extensionName: string = await getExtensionName();
            let shouldShowBadgeVar: boolean = await shouldShowBadge();
            let requestsCount: number = (
              await RateLimiter.checkRateLimit(false)
            ).requestsCount;
            let configuration_key: string = (await getIdentifier()).split(
              "_",
            )[1];
            sendMessageToWebsite(
              {
                message: "info-to-display-in-table",
                settingsLink: settingsLink,
                extensionName: extensionName,
                extensionId: extensionId,
                optInStatus: optInStatus,
                currentlyActive: currentlyActive,
                configurationKey: configuration_key,
                shouldShowBadge: shouldShowBadgeVar,
                requestsCount: requestsCount,
                id: message_id,
              },
              extension_id_original,
            );
          }
          if (message.action === "setShouldShowBadge") {
            setShouldShowBadge().then(() => {
              sendMessageToWebsite(
                {
                  message: "set-should-show-badge",
                  id: message_id,
                },
                extension_id_original,
              );
            });
          }
          if (message.action === "unsetShouldShowBadge") {
            unsetShouldShowBadge().then(() => {
              sendMessageToWebsite(
                {
                  message: "unset-should-show-badge",
                  id: message_id,
                },
                extension_id_original,
              );
            });
          }
        });
      }
    }
  });
}

function getIfCurrentlyActive(): Promise<boolean> {
  return new Promise((resolve) => {
    sendMessageToBackground({ intent: "getIfCurrentlyActiveBCK" }).then(
      (response) => {
        resolve(response);
      },
    );
  });
}

function sendMessageToWebsite(message: any, extension_id: string) {
  const channelFromExtensionToSite: HTMLInputElement | null =
    document.getElementById(
      `message-from-extension-to-site-${extension_id}`,
    ) as HTMLInputElement;
  if (channelFromExtensionToSite) {
    channelFromExtensionToSite.value = JSON.stringify(message);
  }
}
