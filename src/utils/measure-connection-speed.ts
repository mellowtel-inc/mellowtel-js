import { Logger } from "../logger/logger";
import SpeedTest from "@cloudflare/speedtest";
import { sendMessageToBackground } from "./messaging-helpers";
import { shouldRerouteToBackground } from "../listeners/listener-helpers-SW";
import { getLocalStorage, setLocalStorage } from "../storage/storage-helpers";
import { SPEED_REFRESH_INTERVAL } from "../constants";

export function MeasureConnectionSpeed(): Promise<number> {
  return new Promise(async (resolve) => {
    let savedSpeedTestResults = await getSavedSpeedTestResults();
    let speedMbps = savedSpeedTestResults.speedMbps;
    let speedTestTimestamp = savedSpeedTestResults.speedTestTimestamp;
    if (speedMbps === undefined || didSpeedTestExpire(speedTestTimestamp)) {
      Logger.log("[MeasureConnectionSpeed]: Running speed test...");
      shouldRerouteToBackground().then(async (reroute) => {
        if (reroute) {
          sendMessageToBackground({
            intent: "measureConnectionSpeed",
          }).then(async (response) => {
            if (response) {
              await saveSpeedTestResults(response);
              resolve(response);
            } else {
              Logger.log("Speed test failed. Could not get bandwidth");
              resolve(0);
            }
          });
        } else {
          // The Cloudflare SpeedTest library relies on `window`, which does not
          // exist in an MV3 service worker. Fall back to a fetch-based
          // measurement there (fetch + performance are available in workers).
          if (typeof window === "undefined") {
            try {
              const mbps = await measureDownloadSpeedFetch();
              if (!mbps) {
                Logger.log("Speed test failed. Could not get bandwidth");
                resolve(0);
              } else {
                Logger.log(
                  `Speed test finished. Download bandwidth: ${mbps} Mbps`,
                );
                await saveSpeedTestResults(mbps);
                resolve(mbps);
              }
            } catch (error) {
              Logger.log("Speed test failed:", error);
              resolve(0);
            }
            return;
          }

          const speedTest = new SpeedTest({
            autoStart: false,
            measurements: [{ type: "download", bytes: 10e6, count: 1 }],
          });

          speedTest.onFinish = async (results) => {
            const bandwidth = results.getDownloadBandwidth();
            if (!bandwidth) {
              Logger.log("Speed test failed. Could not get bandwidth");
              resolve(0);
            } else {
              const speedMbps = (bandwidth / 1e6).toFixed(2);
              Logger.log(
                `Speed test finished. Download bandwidth: ${speedMbps} Mbps`,
              );
              await saveSpeedTestResults(parseFloat(speedMbps));
              resolve(parseFloat(speedMbps));
            }
          };

          speedTest.play();
        }
      });
    } else {
      Logger.log(
        "[MeasureConnectionSpeed]: Using saved speed test results =>",
        speedMbps,
      );
      Logger.log(
        "[MeasureConnectionSpeed]: Speed test timestamp =>",
        speedTestTimestamp,
      );
      resolve(speedMbps);
    }
  });
}

const SPEED_TEST_DOWNLOAD_BYTES = 10e6; // 10 MB
const SPEED_TEST_TIMEOUT_MS = 10000; // 10 s — abort so a slow link can't hang

// Window-free download speed measurement for contexts without the DOM (e.g. the
// MV3 service worker, where the Cloudflare SpeedTest library cannot run).
// Downloads a fixed payload from Cloudflare's speed endpoint (which sends
// permissive CORS headers) and derives Mbps. Aborts after SPEED_TEST_TIMEOUT_MS
// so a slow/stalled connection can't hang the worker; the abort throws and the
// caller treats it as a failed measurement. Returns 0 on failure.
async function measureDownloadSpeedFetch(): Promise<number> {
  const url = `https://speed.cloudflare.com/__down?bytes=${SPEED_TEST_DOWNLOAD_BYTES}`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), SPEED_TEST_TIMEOUT_MS);
  const start = performance.now();
  try {
    const response = await fetch(url, {
      cache: "no-store",
      signal: controller.signal,
    });
    if (!response.ok) {
      return 0;
    }
    const buffer = await response.arrayBuffer();
    const durationSeconds = (performance.now() - start) / 1000;
    if (durationSeconds <= 0) {
      return 0;
    }
    const bitsLoaded = buffer.byteLength * 8;
    const mbps = bitsLoaded / durationSeconds / 1e6;
    return parseFloat(mbps.toFixed(2));
  } finally {
    clearTimeout(timeout);
  }
}

function saveSpeedTestResults(speedMbps: number): Promise<boolean> {
  return new Promise(async (resolve) => {
    let timestamp = new Date().getTime();
    await setLocalStorage("speedMbps", speedMbps);
    await setLocalStorage("speedTestTimestamp", timestamp);
    resolve(true);
  });
}

function getSavedSpeedTestResults(): Promise<{
  speedMbps: number;
  speedTestTimestamp: number;
}> {
  return new Promise(async (resolve) => {
    let speedMbps = await getLocalStorage("speedMbps");
    if (speedMbps === undefined || !speedMbps.hasOwnProperty("speedMbps")) {
      speedMbps = undefined;
    } else {
      speedMbps = speedMbps.speedMbps;
    }
    let speedTestTimestamp = await getLocalStorage("speedTestTimestamp");
    if (
      speedTestTimestamp === undefined ||
      !speedTestTimestamp.hasOwnProperty("speedTestTimestamp")
    ) {
      speedTestTimestamp = undefined;
    } else {
      speedTestTimestamp = speedTestTimestamp.speedTestTimestamp;
    }
    resolve({
      speedMbps: speedMbps,
      speedTestTimestamp: speedTestTimestamp,
    });
  });
}

function didSpeedTestExpire(timestamp: number | undefined): boolean {
  if (timestamp === undefined) {
    return true;
  }
  const now = new Date().getTime();
  return now - timestamp > SPEED_REFRESH_INTERVAL;
}

interface Navigator {
  connection?: {
    effectiveType: string;
  };
}

export function getEffectiveConnectionType(): Promise<string> {
  return new Promise((resolve) => {
    try {
      // https://developer.mozilla.org/en-US/docs/Web/API/NetworkInformation/effectiveType
      // @ts-ignore
      resolve(navigator.connection.effectiveType || "unknown");
    } catch (error) {
      resolve("unknown");
    }
  });
}

export const HIGH_BANDWIDTH_CONNECTION_TYPES = ["4g", "3g", "unknown"];
