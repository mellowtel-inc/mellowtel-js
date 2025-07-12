import WebSocket from "isomorphic-ws";
import {
  VERSION,
  REFRESH_INTERVAL,
  MAX_PARALLEL_EXECUTIONS_BATCH,
  MAX_PARALLEL_EXECUTIONS_BATCH_FETCH,
  WS_MESSAGE_RATE_LIMIT_MAX_REQUESTS,
  WS_MESSAGE_RATE_LIMIT_TIME_WINDOW,
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
import { isMeucciEnabled } from "../meucci/meucci-utils";
import { refreshCereal } from "../cereal/cereal-index";

let retryAttemptInProgress: boolean = false;
const ws_url: string = "wss://ws.mellow.tel";
const INITIAL_RETRY_DELAY: number = 30 * 1000; // 30 seconds
const MAX_RETRY_DELAY: number = 60 * 60 * 1000; // 1 hour
const RETRY_DELAYS: number[] = [
  INITIAL_RETRY_DELAY, // 30 seconds
  60 * 1000, // 1 minute
  5 * 60 * 1000, // 5 minutes
  10 * 60 * 1000, // 10 minutes
  20 * 60 * 1000, // 20 minutes
  MAX_RETRY_DELAY, // 1 hour
];

let is_websocket_connected: boolean = false;
let retryAttempt: number = 0;
let retryTimeout: any = null;

let wsMessageTimestamps: number[] = [];

function checkWebSocketMessageRateLimit(): boolean {
  Logger.log(`[🌐]: Checking WebSocket message rate limit...`);
  const now = Date.now();
  const cutoffTime = now - WS_MESSAGE_RATE_LIMIT_TIME_WINDOW;
  Logger.log(`[🌐]: Now: ${now}`);
  Logger.log(`[🌐]: Cutoff time: ${cutoffTime}`);

  wsMessageTimestamps = wsMessageTimestamps.filter(
    (timestamp) => timestamp > cutoffTime,
  );
  Logger.log(`[🌐]: Filtered timestamps: ${wsMessageTimestamps}`);
  if (wsMessageTimestamps.length >= WS_MESSAGE_RATE_LIMIT_MAX_REQUESTS) {
    Logger.log(
      `[🌐]: WebSocket message rate limit exceeded. ${wsMessageTimestamps.length} messages in last ${WS_MESSAGE_RATE_LIMIT_TIME_WINDOW / 1000} seconds. Ignoring message.`,
    );
    return false;
  }

  wsMessageTimestamps.push(now);
  return true;
}

// Approval API - constants
const APPROVAL_RETRY_DELAYS: number[] = [
  INITIAL_RETRY_DELAY, // 30 seconds
  60 * 1000, // 1 minute
  5 * 60 * 1000, // 5 minutes
  10 * 60 * 1000, // 10 minutes
  20 * 60 * 1000, // 20 minutes
  MAX_RETRY_DELAY, // 1 hour
];
const APPROVAL_CHECK_INTERVAL = 30 * 60 * 1000; // 30 minutes
const APPROVAL_API_URL = "https://api.mellow.tel/approval";

interface ApprovalCacheData {
  timestamp: number;
  isApproved: boolean;
}

async function checkWebsocketApproval(params: {
  device_id: string;
  plugin_id: string;
  version: string;
  speed_download: number;
  platform: string;
  manifest_version: string;
  pascoli: boolean;
  burke: boolean;
  meucci: boolean;
}): Promise<boolean> {
  // Check if we have a cached result
  const cachedData = await getLocalStorage("websocket_approval_cache", true);
  const now = Date.now();

  if (cachedData) {
    const data: ApprovalCacheData = JSON.parse(cachedData);
    if (now - data.timestamp < APPROVAL_CHECK_INTERVAL) {
      Logger.log(
        `[🌐]: Using cached websocket approval result with timestamp: ${data.timestamp}. Minutes until expiration: ${
          (APPROVAL_CHECK_INTERVAL - (now - data.timestamp)) / 60000
        }`,
      );
      return data.isApproved;
    }
  }

  // Build query parameters
  const queryParams = new URLSearchParams({
    device_id: params.device_id,
    plugin_id: params.plugin_id,
    version: params.version,
    speed_download: params.speed_download.toString(),
    platform: params.platform,
    manifest_version: params.manifest_version,
    pascoli: params.pascoli.toString(),
    burke: params.burke.toString(),
    meucci: params.meucci.toString(),
    ws_client: "new_ws",
  });

  return retryApprovalRequest(`${APPROVAL_API_URL}?${queryParams.toString()}`);
}

async function retryApprovalRequest(
  url: string,
  retryAttempt: number = 0,
): Promise<boolean> {
  try {
    retryAttemptInProgress = true;
    // Simple fetch without timeout controller
    const response = await fetch(url);

    // Process response if successful
    const result = await response.json();

    if (!response.ok) {
      throw new Error(
        `[🌐]: Approval request failed with status code ${response.status}`,
      );
    }

    Logger.log(`[🌐]: Approval result: ${JSON.stringify(result)}`);
    retryAttemptInProgress = false;

    // Cache the result on successful API call
    const cacheData: ApprovalCacheData = {
      timestamp: Date.now(),
      isApproved: result.approval === true,
    };
    await setLocalStorage(
      "websocket_approval_cache",
      JSON.stringify(cacheData),
    );

    return result.approval === true;
  } catch (error) {
    Logger.log(`[🌐]: Approval error: ${error}`);
    retryAttemptInProgress = true;
    // Get the delay for this retry attempt, use max delay if we've exceeded the array length
    const delay =
      retryAttempt < APPROVAL_RETRY_DELAYS.length
        ? APPROVAL_RETRY_DELAYS[retryAttempt]
        : APPROVAL_RETRY_DELAYS[APPROVAL_RETRY_DELAYS.length - 1]; // Continue with max delay indefinitely

    Logger.log(
      `[🌐]: Approval request failed (attempt ${retryAttempt + 1}). Retrying in ${delay / 1000} seconds. Will continue indefinitely:`,
      error,
    );

    // Wait for the backoff period
    await new Promise((resolve) => setTimeout(resolve, delay));

    // Retry with incremented attempt counter
    return retryApprovalRequest(url, retryAttempt + 1);
  }
}

export async function startConnectionWs(identifier: string): WebSocket {
  if (retryAttemptInProgress) {
    Logger.log(
      `[🌐]: Retry attempt already in progress, not starting new connection`,
    );
    return;
  }

  // Clear any existing retry timeout
  if (retryTimeout) {
    clearTimeout(retryTimeout);
    retryTimeout = null;
  }

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
          retryAttempt = 0;
          await RateLimiter.resetRateLimitData(now, false);
          startConnectionWs(identifier);
        }
      } else {
        const extension_identifier: string = await getExtensionIdentifier();
        const speedMpbs: number = await MeasureConnectionSpeed();
        Logger.log(`[🌐]: Connection speed: ${speedMpbs} Mbps`);
        const browser = detectBrowser();
        Logger.log(`[🌐]: Browser: ${browser}`);
        const isPascoli: boolean = await isPascoliEnabled();
        const isMeucci: boolean = await isMeucciEnabled();
        Logger.log(`[🌐]: Manifest version: ${manifestVersion}`);
        Logger.log(`[🌐]: Extension identifier: ${extension_identifier}`);
        Logger.log(`[🌐]: Is Pascoli enabled: ${isPascoli}`);
        Logger.log(`[🌐]: Is Meucci enabled: ${isMeucci}`);
        // Check websocket approval before connecting
        const isApproved = await checkWebsocketApproval({
          device_id: identifier,
          plugin_id: extension_identifier,
          version: VERSION,
          speed_download: speedMpbs,
          platform: browser,
          manifest_version: manifestVersion.toString(),
          pascoli: isPascoli,
          burke: isMeucci,
          meucci: isMeucci,
        });

        if (!isApproved) {
          Logger.log(`[🌐]: Websocket connection not approved by API`);
          return;
        }

        Logger.log(
          `[🌐]: Websocket connection approved, establishing connection...`,
        );

        const ws = new WebSocket(
          `${ws_url}?device_id=${identifier}&version=${VERSION}&plugin_id=${encodeURIComponent(extension_identifier)}&speed_download=${speedMpbs}&platform=${browser}&manifest_version=${manifestVersion}&pascoli=${isPascoli}&burke=${isMeucci}&meucci=${isMeucci}&ws_client=new_ws`,
        );

        ws.onopen = function open() {
          retryAttempt = 0; // Reset retry counter on successful connection
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
            const delay =
              RETRY_DELAYS[Math.min(retryAttempt, RETRY_DELAYS.length - 1)];
            Logger.log(
              `[🌐]: Connection closed. Attempting reconnect in ${delay / 1000} seconds...`,
            );
            retryTimeout = setTimeout(async () => {
              retryAttempt++;
              await startConnectionWs(identifier);
            }, delay);
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

            if (!checkWebSocketMessageRateLimit()) {
              Logger.log(
                `[🌐]: Local WebSocket Rate limit exceeded, ignoring message...`,
              );
              return; // Ignore the message if rate limit exceeded
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
