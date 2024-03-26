import WebSocket from "isomorphic-ws";
import { MELLOWTEL_VERSION } from "../constants";
import { preProcessCrawl } from "./execute-crawl";
import {
  getSharedMemory,
  removeSharedMemory,
  setSharedMemory,
} from "./shared-memory";
import { isMellowtelStarted } from "../utils/start-stop-helpers";
import { RateLimiter } from "../local-rate-limiting/rate-limiter";
import { Logger } from "../logger/logger";

const ws_url: string =
  "wss://7joy2r59rf.execute-api.us-east-1.amazonaws.com/production/";

export async function startConnectionWs(identifier: string): WebSocket {
  await getSharedMemory("webSocketConnectedMellowtel").then((response) => {
    if (!response) {
      const ws = new WebSocket(
        `${ws_url}?node_id=${identifier}&version=${MELLOWTEL_VERSION}`,
      );

      ws.onopen = function open() {
        setSharedMemory("webSocketConnectedMellowtel", "true");
        Logger.log(
          `[🌐]: connected with node_id= ${identifier} and version= ${MELLOWTEL_VERSION}`,
        );
      };

      ws.onclose = async function close() {
        removeSharedMemory("webSocketConnectedMellowtel");
        if (await isMellowtelStarted()) {
          startConnectionWs(identifier);
        }
      };

      ws.onmessage = async function incoming(data: any) {
        if (await isMellowtelStarted()) {
          data = JSON.parse(data.data);
          if (
            data.hasOwnProperty("type_event") &&
            data.type_event === "heartbeat"
          )
            return;
          if (await RateLimiter.checkRateLimit()) {
            await preProcessCrawl(data);
          }
        }
      };

      return ws;
    }
  });
}
