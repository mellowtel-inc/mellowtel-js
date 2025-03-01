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

// WebSocket service class to manage the connection
class WebSocketService {
  private static instance: WebSocketService;
  private ws: WebSocket | null = null;
  private is_websocket_connected: boolean = false;
  private retryAttempt: number = 0;
  private retryTimeout: any = null;
  private identifier: string = "";

  private constructor() {
    // Private constructor to prevent direct instantiation
  }

  // Singleton pattern to ensure only one instance exists
  public static getInstance(): WebSocketService {
    if (!WebSocketService.instance) {
      WebSocketService.instance = new WebSocketService();
    }
    return WebSocketService.instance;
  }

  // Check if WebSocket is connected
  public isConnected(): boolean {
    return this.is_websocket_connected;
  }

  // Get the WebSocket instance
  public getWebSocket(): WebSocket | null {
    return this.ws;
  }

  // Send a message through the WebSocket
  public sendMessage(message: any): boolean {
    try {
      Logger.log("[🌐]: Sending message through WebSocket...");
      Logger.log(message);
      Logger.log("##############################");
      this.ws.send(
          typeof message === "string" ? message : JSON.stringify(message),
      );
      return true;
    } catch (error) {
        Logger.log("[🌐]: Error sending message:", error);
        return false;
    }
    /*if (this.ws) {
      this.ws.send(
        typeof message === "string" ? message : JSON.stringify(message),
      );
      return true;
    }
    Logger.log("[🌐]: WebSocket not connected, cannot send message");
    return false;*/
  }

  // Close the WebSocket connection
  public closeConnection(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
      this.is_websocket_connected = false;
      if (this.retryTimeout) {
        clearTimeout(this.retryTimeout);
        this.retryTimeout = null;
      }
    }
  }

  // Start the WebSocket connection
  public async startConnection(identifier: string): Promise<void> {
    this.identifier = identifier;

    // Clear any existing retry timeout
    if (this.retryTimeout) {
      clearTimeout(this.retryTimeout);
      this.retryTimeout = null;
    }

    // if mv2, we can send message to bg and start the ws there since there is a DOM
    // in mv3, we need to start the ws here in the content script
    let manifestVersion = getManifestVersion();
    let isInServiceWorker: boolean = await isInSW();
    Logger.log("############################################################");
    Logger.log(`[startConnection]: Manifest version: ${manifestVersion}`);
    Logger.log(`[startConnection]: Is in service worker: ${isInServiceWorker}`);

    if (!isInServiceWorker) {
      Logger.log(
        `[🌐]: MV2/MV3 Sending message to background to start websocket...`,
      );
      await sendMessageToBackground({
        intent: "startWebsocket",
        identifier: identifier,
      });
      return;
    }

    let effectiveConnectionType: string = await getEffectiveConnectionType();
    Logger.log(`[🌐]: Effective connection type: ${effectiveConnectionType}`);
    if (!HIGH_BANDWIDTH_CONNECTION_TYPES.includes(effectiveConnectionType)) {
      Logger.log(`[🌐]: Not connecting to websocket to preserve bandwidth`);
      return;
    }

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

    // If already connected, don't connect again
    if (this.is_websocket_connected) {
      Logger.log(`[🌐]: WebSocket already connected`);
      return;
    }

    // Check rate limiting
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
        this.retryAttempt = 0; // Reset retry attempt counter
        await RateLimiter.resetRateLimitData(now, false);
        this.startConnection(identifier);
      }
      return;
    }

    // Initialize the WebSocket
    await this.initializeWebSocket();
  }

  // Initialize the WebSocket with all necessary event handlers
  private async initializeWebSocket(): Promise<void> {
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

    this.ws = new WebSocket(
      `${ws_url}?device_id=${this.identifier}&version=${VERSION}&plugin_id=${encodeURIComponent(extension_identifier)}&speed_download=${speedMpbs}&platform=${browser}&manifest_version=${manifestVersion}&pascoli=${isPascoli}&ws_client=new_ws`,
    );

    this.ws.onopen = () => {
      this.retryAttempt = 0; // Reset retry counter on successful connection
      this.is_websocket_connected = true;

      // For MV2, also set in DOM model
      if (manifestVersion.toString() === "2") {
        Logger.log(`[🌐]: MV2 Setting webSocketConnected in DOM MODEL...`);
        let hiddenInput: HTMLInputElement = document.createElement("input");
        hiddenInput.setAttribute("type", "hidden");
        hiddenInput.setAttribute("id", "webSocketConnected");
        hiddenInput.setAttribute("value", "true");
        document.body.appendChild(hiddenInput);
      }

      Logger.log(
        `[🌐]: connected with device_id= ${this.identifier} and version= ${VERSION}`,
      );
    };

    this.ws.onclose = async () => {
      this.is_websocket_connected = false;

      // For MV2, also remove from DOM model
      if (manifestVersion.toString() === "2") {
        document.getElementById("webSocketConnected")?.remove();
      }

      let isDeviceDisconnectSession: boolean = await getLocalStorage(
        "device_disconnect_session",
        true,
      );
      Logger.log("[🌐]: Discon.Sess =>", isDeviceDisconnectSession);
      if ((await isStarted()) && !isDeviceDisconnectSession) {
        const delay =
          RETRY_DELAYS[Math.min(this.retryAttempt, RETRY_DELAYS.length - 1)];
        Logger.log(
          `[🌐]: Connection closed. Attempting reconnect in ${delay / 1000} seconds...`,
        );
        this.retryTimeout = setTimeout(async () => {
          this.retryAttempt++;
          await this.startConnection(this.identifier);
        }, delay);
      }
    };

    this.ws.onmessage = async (event: any) => {
      if (await isStarted()) {
        let data = JSON.parse(event.data);

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
          this.closeConnection();
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
        if (data.hasOwnProperty("type_event") && data.type_event === "batch") {
          BATCH_execution = true;
          batch_id = data.batch_id;
          let type_batch: string = "request";
          if (data.hasOwnProperty("type_batch")) type_batch = data.type_batch;
          if (data.hasOwnProperty("parallel_executions_batch")) {
            parallelExecutionsBatch = Math.min(
              parseInt(data.parallel_executions_batch),
              type_batch === "request"
                ? MAX_PARALLEL_EXECUTIONS_BATCH
                : MAX_PARALLEL_EXECUTIONS_BATCH_FETCH,
            );
          }
          if (data.hasOwnProperty("delay_between_executions")) {
            delayBetweenExecutions = parseInt(data.delay_between_executions);
          }
        }

        let { shouldContinue, isLastCount } =
          await RateLimiter.checkRateLimit();
        if (shouldContinue || POST_request || BATCH_execution || GET_request) {
          if (
            isLastCount &&
            !POST_request &&
            !BATCH_execution &&
            !GET_request
          ) {
            Logger.log(`[🌐]: Last count reached, closing connection...`);
            await setLocalStorage("mllwtl_rate_limit_reached", true);
            this.closeConnection();
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
          this.closeConnection();
        }
      }
    };
  }
}

// Legacy function for compatibility with existing code
export async function startConnectionWs(
  identifier: string,
): Promise<WebSocket | null> {
  const wsService = WebSocketService.getInstance();
  await wsService.startConnection(identifier);
  return wsService.getWebSocket();
}

// Export the WebSocketService singleton for direct use in other files
export const websocketService = WebSocketService.getInstance();
