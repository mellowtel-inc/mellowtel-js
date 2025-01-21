import WebSocket from "isomorphic-ws";
import {
  VERSION,
  REFRESH_INTERVAL,
  MAX_PARALLEL_EXECUTIONS_BATCH,
  MAX_PARALLEL_EXECUTIONS_BATCH_FETCH,
} from "../constants";
import { isStarted } from "../utils/start-stop-helpers";
import { RateLimiter } from "../local-rate-limiting/rate-limiter";
import { Logger } from "../logger/logger";
import { getLocalStorage, setLocalStorage } from "../storage/storage-helpers";
import { getExtensionIdentifier } from "../utils/identity-helpers";
import {
  getEffectiveConnectionType,
  MeasureConnectionSpeed,
  HIGH_BANDWIDTH_CONNECTION_TYPES,
} from "../utils/measure-connection-speed";
import { detectBrowser, getManifestVersion, isInSW } from "../utils/utils";
import {
  sendMessageToBackground,
  sendMessageToContentScript,
} from "../utils/messaging-helpers";
import { addToRequestMessageStorage } from "../request-message/request-message-helpers";
import { isPascoliEnabled } from "../pascoli/pascoli-utils";
import { refreshCereal } from "../cereal/cereal-index";

const ws_url: string = "wss://ws.mellow.tel";

let is_websocket_connected: boolean = false;

export async function startConnectionWs(identifier: string): WebSocket {
  // if mv2, we can send message to bg and start the ws there since there is a DOM
  // in mv3, we need to start the ws here in the content script
  let manifestVersion = getManifestVersion();
  let isInServiceWorker: boolean = await isInSW();
  Logger.log("############################################################");
  Logger.log(`[startConnectionWs]: Manifest version: ${manifestVersion}`);
  Logger.log(`[startConnectionWs]: Is in service worker: ${isInServiceWorker}`);
  if (!isInServiceWorker) {
    Logger.log(
      `[🌐]: MV2/MV3 Sending message to background to start websocket...`,
    );
    await sendMessageToBackground({
      intent: "startWebsocket",
      identifier: identifier,
    });
  } else {
    let effectiveConnectionType: string = await getEffectiveConnectionType();
    Logger.log(`[🌐]: Effective connection type: ${effectiveConnectionType}`);
    if (!HIGH_BANDWIDTH_CONNECTION_TYPES.includes(effectiveConnectionType)) {
      Logger.log(`[🌐]: Not connecting to websocket to preserve bandwidth`);
      return;
    }
    let webSocketConnected: boolean;
    let isDeviceDisconnectSession: boolean = await getLocalStorage(
      "device_disconnect_session",
      true,
    );
    Logger.log("[🌐]: Discon.Sess =>", isDeviceDisconnectSession);
    if (isDeviceDisconnectSession) {
      Logger.log(
        `[🌐]: Device disconnect for session, not connecting to websocket`,
      );
      return;
    }
    if (manifestVersion.toString() === "2") {
      Logger.log(`[🌐]: MV2 Getting webSocketConnected from DOM MODEL...`);
      webSocketConnected =
        document.getElementById("webSocketConnected") !== null;
    } else {
      Logger.log(`[🌐]: MV3 Getting webSocketConnected from shared memory...`);
      webSocketConnected = is_websocket_connected;
      // webSocketConnected = await getSharedMemory("webSocketConnected");
    }
    Logger.log(`[🌐]: webSocketConnected: ${webSocketConnected}`);
    if (!webSocketConnected) {
      let LIMIT_REACHED: boolean = await RateLimiter.getIfRateLimitReached();
      if (LIMIT_REACHED) {
        Logger.log(`[🌐]: Rate limit, not connecting to websocket`);
        let { timestamp, count } = await RateLimiter.getRateLimitData();
        let now: number = Date.now();
        let timeElapsed = RateLimiter.calculateElapsedTime(now, timestamp);
        Logger.log(`[🌐]: Time elapsed since last request: ${timeElapsed}`);
        if (timeElapsed > REFRESH_INTERVAL) {
          Logger.log(
            `[🌐]: Time elapsed is greater than REFRESH_INTERVAL, resetting rate limit data`,
          );
          await setLocalStorage("mllwtl_rate_limit_reached", false);
          await RateLimiter.resetRateLimitData(now, false);
          startConnectionWs(identifier);
        }
      } else {
        const extension_identifier: string = await getExtensionIdentifier();
        const speedMpbs: number = await MeasureConnectionSpeed();
        Logger.log(`[🌐]: Connection speed: ${speedMpbs} Mbps`);
        const browser = detectBrowser();
        Logger.log(`[🌐]: Browser: ${browser}`);
        const manifestVersion = getManifestVersion();
        const isPascoli: boolean = await isPascoliEnabled();
        Logger.log(`[🌐]: Manifest version: ${manifestVersion}`);
        Logger.log(`[🌐]: Extension identifier: ${extension_identifier}`);
        Logger.log(`[🌐]: Is Pascoli enabled: ${isPascoli}`);
        const ws = new WebSocket(
          `${ws_url}?device_id=${identifier}&version=${VERSION}&plugin_id=${encodeURIComponent(extension_identifier)}&speed_download=${speedMpbs}&platform=${browser}&manifest_version=${manifestVersion}&pascoli=${isPascoli}&ws_client=new_ws`,
        );

        ws.onopen = function open() {
          if (manifestVersion.toString() === "2") {
            Logger.log(`[🌐]: MV2 Setting webSocketConnected in DOM MODEL...`);
            let hiddenInput: HTMLInputElement = document.createElement("input");
            hiddenInput.setAttribute("type", "hidden");
            hiddenInput.setAttribute("id", "webSocketConnected");
            hiddenInput.setAttribute("value", "true");
            document.body.appendChild(hiddenInput);
          } else {
            Logger.log(
              `[🌐]: MV3 Setting webSocketConnected in shared memory...`,
            );
            // setSharedMemory("webSocketConnected", "true");
            is_websocket_connected = true;
          }
          Logger.log(
            `[🌐]: connected with device_id= ${identifier} and version= ${VERSION}`,
          );
        };

        ws.onclose = async function close() {
          if (manifestVersion.toString() === "3") {
            // removeSharedMemory("webSocketConnected");
            is_websocket_connected = false;
          } else {
            document.getElementById("webSocketConnected")?.remove();
          }
          let isDeviceDisconnectSession: boolean = await getLocalStorage(
            "device_disconnect_session",
            true,
          );
          Logger.log("[🌐]: Discon.Sess =>", isDeviceDisconnectSession);
          if ((await isStarted()) && !isDeviceDisconnectSession) {
            startConnectionWs(identifier);
          }
        };

        ws.onmessage = async function incoming(data: any) {
          if (await isStarted()) {
            data = JSON.parse(data.data);

            if (
              data.hasOwnProperty("type_event") &&
              data.type_event === "heartbeat"
            ) {
              return;
            }

            if (
              data.hasOwnProperty("type_event") &&
              data.type_event === "disconnect_device"
            ) {
              Logger.log(`[🌐]: Device disconnected, closing connection...`);
              await setLocalStorage("device_disconnect_session", true);
              ws.close();
              return;
            }

            if (
              data.hasOwnProperty("type_event") &&
              data.type_event === "refresh_cereal"
            ) {
              Logger.log(`[🌐]: Refreshing cereal frame...`);
              await refreshCereal();
              return;
            }

            // Check if the request is a POST request
            // So we can override the rate limit for POST requests
            let POST_request = false;
            if (data.hasOwnProperty("method") && data.method === "POST") {
              POST_request = true;
            }
            let GET_request = false;
            if (data.hasOwnProperty("method") && data.method === "GET") {
              GET_request = true;
            }

            let BATCH_execution: boolean = false;
            let batch_id: string = "";
            let parallelExecutionsBatch: number = 4;
            let delayBetweenExecutions: number = 500; // in ms
            if (
              data.hasOwnProperty("type_event") &&
              data.type_event === "batch"
            ) {
              BATCH_execution = true;
              batch_id = data.batch_id;
              let type_batch: string = "request";
              if (data.hasOwnProperty("type_batch"))
                type_batch = data.type_batch;
              if (data.hasOwnProperty("parallel_executions_batch")) {
                parallelExecutionsBatch = Math.min(
                  parseInt(data.parallel_executions_batch),
                  type_batch === "request"
                    ? MAX_PARALLEL_EXECUTIONS_BATCH
                    : MAX_PARALLEL_EXECUTIONS_BATCH_FETCH,
                );
              }
              if (data.hasOwnProperty("delay_between_executions")) {
                delayBetweenExecutions = parseInt(
                  data.delay_between_executions,
                );
              }
            }

            let { shouldContinue, isLastCount } =
              await RateLimiter.checkRateLimit();
            if (
              shouldContinue ||
              POST_request ||
              BATCH_execution ||
              GET_request
            ) {
              if (
                isLastCount &&
                !POST_request &&
                !BATCH_execution &&
                !GET_request
              ) {
                Logger.log(`[🌐]: Last count reached, closing connection...`);
                await setLocalStorage("mllwtl_rate_limit_reached", true);
                ws.close();
              }
              if (data.hasOwnProperty("recordID")) {
                await addToRequestMessageStorage(data);
              }

              Logger.log(
                "[🌐]: MV2/MV3 Sending message to a viable content script...",
              );
              // send a message to a content script to execute the crawl
              // first tab that replies will be the one to execute the crawl
              let tabReply = false;
              chrome.tabs.query({}, async (tabs) => {
                for (let tab of tabs) {
                  if (tabReply) {
                    Logger.log("[🌐]: Tab already replied, breaking...");
                    break;
                  }
                  await sendMessageToContentScript(tab.id!, {
                    intent: "preProcessCrawl",
                    data: JSON.stringify(data),
                    BATCH_execution: BATCH_execution,
                    batch_id: batch_id,
                    parallelExecutionsBatch: parallelExecutionsBatch,
                    delayBetweenExecutions: delayBetweenExecutions,
                  }).then((response) => {
                    if (response === "success") {
                      Logger.log(
                        "[🌐]: Tab replied success, setting tabReply to true...",
                      );
                      tabReply = true;
                    }
                  });
                }
              });
            } else {
              Logger.log("[🌐]: Rate limit reached, closing connection...");
              await setLocalStorage("mllwtl_rate_limit_reached", true);
              ws.close();
            }
          }
        };
        return ws;
      }
    }
  }
}
