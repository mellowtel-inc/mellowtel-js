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
    let timestamp = await getLocalStorage("timestamp_m");
    if (timestamp === undefined || !timestamp.hasOwnProperty("timestamp_m")) {
      timestamp = undefined;
    } else {
      timestamp = parseInt(timestamp.timestamp_m);
    }
    let count = await getLocalStorage("count_m");
    if (count === undefined || !count.hasOwnProperty("count_m")) {
      count = undefined;
    } else {
      count = parseInt(count.count_m);
    }
    return { timestamp, count };
  }

  static async setRateLimitData(
    timestamp: number,
    count: number,
  ): Promise<void> {
    await setLocalStorage("timestamp_m", timestamp);
    await setLocalStorage("count_m", count);
  }

  static async getLifetimeTotalCount(): Promise<{
    lifetime_total_count: number;
  }> {
    let lifetime_total_count = await getLocalStorage("lifetime_total_count_m");
    if (
      lifetime_total_count === undefined ||
      !lifetime_total_count.hasOwnProperty("lifetime_total_count_m")
    ) {
      lifetime_total_count = 0;
    } else {
      lifetime_total_count = parseInt(
        lifetime_total_count.lifetime_total_count_m,
      );
    }
    return { lifetime_total_count };
  }

  static async setHistoricData(
    initial_timestamp: number,
    lifetime_total_count: number,
  ): Promise<void> {
    await setLocalStorage("initial_timestamp_m", initial_timestamp);
    await setLocalStorage("lifetime_total_count_m", lifetime_total_count);
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

  static async checkRateLimit(increase_count: boolean = true): Promise<{
    shouldContinue: boolean;
    isLastCount: boolean;
    requestsCount: number;
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
        requestsCount: 0,
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
        requestsCount: 0,
      };
    }

    if (increase_count) {
      count++;
      await setLocalStorage("count_m", count);
      lifetime_total_count++;
      await setLocalStorage("lifetime_total_count_m", lifetime_total_count);
    }
    Logger.log(
      `[🕒]: SHOULD CONTINUE? IF COUNT (${count}) <= ${this.MAX_DAILY_RATE} : ${count <= this.MAX_DAILY_RATE}`,
    );
    if (count <= this.MAX_DAILY_RATE) {
      let isLastCount: boolean = count === this.MAX_DAILY_RATE;
      return {
        shouldContinue: true,
        isLastCount,
        requestsCount: count,
      };
    } else {
      Logger.log(`[🕒]: RATE LIMIT REACHED`);
      return {
        shouldContinue: false,
        isLastCount: false,
        requestsCount: count,
      };
    }
  }
}
