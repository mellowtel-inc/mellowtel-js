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

  static async getLifetimeTotalCount(): Promise<{
    lifetime_total_count: number;
  }> {
    let lifetime_total_count = await getLocalStorage(
      "lifetime_total_count_mellowtel",
    );
    if (
      lifetime_total_count === undefined ||
      !lifetime_total_count.hasOwnProperty("lifetime_total_count_mellowtel")
    ) {
      lifetime_total_count = 0;
    } else {
      lifetime_total_count = parseInt(
        lifetime_total_count.lifetime_total_count_mellowtel,
      );
    }
    return { lifetime_total_count };
  }

  static async setHistoricData(
    initial_timestamp: number,
    lifetime_total_count: number,
  ): Promise<void> {
    await setLocalStorage("initial_timestamp_mellowtel", initial_timestamp);
    await setLocalStorage(
      "lifetime_total_count_mellowtel",
      lifetime_total_count,
    );
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
    let { lifetime_total_count } = await this.getLifetimeTotalCount();

    if (!timestamp) {
      Logger.log(
        `[🕒]: NO_TIMESTAMP, setting timestamp, count, and historic data`,
      );
      await this.setRateLimitData(now, 1);
      await this.setHistoricData(now, 1);
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
    lifetime_total_count++;
    await setLocalStorage(
      "lifetime_total_count_mellowtel",
      lifetime_total_count,
    );
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
