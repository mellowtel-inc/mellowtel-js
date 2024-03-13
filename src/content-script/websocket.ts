import WebSocket from "isomorphic-ws";
import { MELLOWTEL_VERSION } from "../constants";
import { preProcessCrawl } from "./execute-crawl";
import {
  getSharedMemory,
  removeSharedMemory,
  setSharedMemory,
} from "./shared-memory";
import { isMellowtelStarted } from "../utils/start-stop-helpers";
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
          await preProcessCrawl(JSON.parse(data.data));
        }
      };

      return ws;
    }
  });
}
