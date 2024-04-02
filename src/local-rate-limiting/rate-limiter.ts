import {
  REFRESH_INTERVAL,
  MAX_DAILY_RATE as DEFAULT_MAX_DAILY_RATE,
} from "../constants";
import { getLocalStorage, setLocalStorage } from "../utils/storage-helpers";
import { Logger } from "../logger/logger";

export class RateLimiter {
  static MAX_DAILY_RATE: number = DEFAULT_MAX_DAILY_RATE;

  static async getRateLimitData(): Promise<{
    timestamp: number;
    count: number;
  }> {
    let timestamp = await getLocalStorage("timestamp_mellowtel");
    if (
      timestamp === undefined ||
      !timestamp.hasOwnProperty("timestamp_mellowtel")
    ) {
      timestamp = undefined;
    } else {
      timestamp = parseInt(timestamp.timestamp_mellowtel);
    }
    let count = await getLocalStorage("count_mellowtel");
    if (count === undefined || !count.hasOwnProperty("count_mellowtel")) {
      count = undefined;
    } else {
      count = parseInt(count.count_mellowtel);
    }
    return { timestamp, count };
  }

  static async setRateLimitData(
    timestamp: number,
    count: number,
  ): Promise<void> {
    await setLocalStorage("timestamp_mellowtel", timestamp);
    await setLocalStorage("count_mellowtel", count);
  }

  static calculateElapsedTime(now: number, timestamp: number): number {
    return now - timestamp;
  }

  static async resetRateLimitData(
    now: number,
    add_to_count: boolean = false,
  ): Promise<void> {
    await this.setRateLimitData(now, add_to_count ? 1 : 0);
  }

  static async getIfRateLimitReached(): Promise<boolean> {
    let mllwtl_rate_limit_object = await getLocalStorage(
      "mllwtl_rate_limit_reached",
    );
    if (
      mllwtl_rate_limit_object === undefined ||
      !mllwtl_rate_limit_object.hasOwnProperty("mllwtl_rate_limit_reached")
    ) {
      return false;
    } else {
      return (
        mllwtl_rate_limit_object.mllwtl_rate_limit_reached.toString() === "true"
      );
    }
  }

  static async checkRateLimit(): Promise<{
    shouldContinue: boolean;
    isLastCount: boolean;
  }> {
    const now = Date.now();
    let { timestamp, count } = await this.getRateLimitData();

    if (!timestamp) {
      Logger.log(`[🕒]: NO_TIMESTAMP, setting timestamp and count`);
      await this.setRateLimitData(now, 1);
      return {
        shouldContinue: true,
        isLastCount: false,
      };
    }

    const elapsedTime: number = this.calculateElapsedTime(now, timestamp);
    if (elapsedTime > REFRESH_INTERVAL) {
      Logger.log(`[🕒]: REFRESH_INTERVAL elapsed, resetting count`);
      await this.resetRateLimitData(now, true);
      await setLocalStorage("mllwtl_rate_limit_reached", false);
      return {
        shouldContinue: true,
        isLastCount: false,
      };
    }

    count++;
    await setLocalStorage("count_mellowtel", count);
    Logger.log(
      `[🕒]: SHOULD CONTINUE? IF COUNT (${count}) <= ${this.MAX_DAILY_RATE} : ${count <= this.MAX_DAILY_RATE}`,
    );
    if (count <= this.MAX_DAILY_RATE) {
      let isLastCount: boolean = count === this.MAX_DAILY_RATE;
      return {
        shouldContinue: true,
        isLastCount,
      };
    } else {
      Logger.log(`[🕒]: RATE LIMIT REACHED`);
      return {
        shouldContinue: false,
        isLastCount: false,
      };
    }
  }
}
