import { getLocalStorage, setLocalStorage } from "../utils/storage-helpers";
import { Logger } from "../logger/logger";
import { MAX_QUEUE_SIZE } from "../constants";

export async function insertInQueue(dataPacket: any) {
  return new Promise((resolve) => {
    getLocalStorage("queue").then((result) => {
      if (result === undefined || !result.hasOwnProperty("queue"))
        result = { queue: [] };
      let queue = result.queue;
      if (queue.length > MAX_QUEUE_SIZE) {
        // ignore this packet
        Logger.log("[🌐] : queue is full. Ignoring this packet");
        resolve(false);
      } else {
        queue.push(dataPacket);
        setLocalStorage("queue", queue).then(() => {
          resolve(true);
        });
      }
    });
  });
}

// Get last from queue (by shifting. Not optimized, but it's kind of ok because n is small)
export async function getLastFromQueue(): Promise<{
  url: string;
  recordID: string;
  eventData: any;
  waitForElement: string;
  shouldSandbox: boolean;
  sandBoxAttributes: string;
}> {
  return new Promise((resolve) => {
    getLocalStorage("queue").then((result) => {
      if (result === undefined || !result.hasOwnProperty("queue"))
        result = { queue: [] };
      let queue = result.queue;
      if (queue.length === 0)
        return resolve({
          url: "",
          recordID: "0123",
          eventData: {},
          waitForElement: "none",
          shouldSandbox: false,
          sandBoxAttributes: "",
        });
      let last = queue.shift();
      setLocalStorage("queue", queue).then(() => {
        resolve(last);
      });
    });
  });
}
