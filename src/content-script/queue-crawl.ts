import { getLocalStorage, setLocalStorage } from "../storage/storage-helpers";
import { Logger } from "../logger/logger";
import { MAX_QUEUE_SIZE } from "../constants";

export async function insertInQueue(dataPacket: any, BATCH_execution: boolean) {
  return new Promise((resolve) => {
    let queueKey = BATCH_execution ? "queue_batch" : "queue";
    getLocalStorage(queueKey).then((result) => {
      if (result === undefined || !result.hasOwnProperty(queueKey))
        result = { [queueKey]: [] };
      let queue = result[queueKey];
      if (queue.length > MAX_QUEUE_SIZE && !BATCH_execution) {
        // ignore this packet
        Logger.log("[🌐] : queue is full. Ignoring this packet");
        resolve(false);
      } else {
        queue.push(dataPacket);
        setLocalStorage(queueKey, queue).then(() => {
          resolve(true);
        });
      }
    });
  });
}

// Get last from queue (by shifting. Not optimized, but it's kind of ok because n is small)
export async function getLastFromQueue(BATCH_execution: boolean): Promise<{
  url: string;
  recordID: string;
  eventData: any;
  waitForElement: string;
  shouldSandbox: boolean;
  sandBoxAttributes: string;
  batch_id: string;
  triggersDownload: boolean;
  skipHeaders: boolean;
  hostname: string;
  htmlVisualizer: boolean;
  htmlContained: boolean;
  screenWidth: string;
  screenHeight: string;
  POST_request: boolean;
  GET_request: boolean;
  methodEndpoint: string;
  methodPayload: string;
  methodHeaders: any;
  actions: string;
  delayBetweenExecutions: number;
  openTab: boolean;
  openTabOnlyIfMust: boolean;
  pascoli: boolean;
  refPolicy: string;
}> {
  return new Promise((resolve) => {
    let queueKey = BATCH_execution ? "queue_batch" : "queue";
    getLocalStorage(queueKey).then((result) => {
      if (result === undefined || !result.hasOwnProperty(queueKey))
        result = { [queueKey]: [] };
      let queue = result[queueKey];
      if (queue.length === 0)
        return resolve({
          url: "",
          recordID: "0123",
          eventData: {},
          waitForElement: "none",
          shouldSandbox: false,
          sandBoxAttributes: "",
          batch_id: "",
          triggersDownload: false,
          skipHeaders: false,
          hostname: "",
          htmlVisualizer: false,
          htmlContained: false,
          screenWidth: "1024px",
          screenHeight: "768px",
          POST_request: false,
          GET_request: false,
          methodEndpoint: "",
          methodPayload: "no_payload",
          methodHeaders: "no_headers",
          actions: "[]",
          delayBetweenExecutions: 500,
          openTab: false,
          openTabOnlyIfMust: false,
          pascoli: false,
          refPolicy: "",
        });
      let last = queue.shift();
      setLocalStorage(queueKey, queue).then(() => {
        resolve(last);
      });
    });
  });
}
