import { getOrGenerateIdentifier } from "./utils/identity-helpers";
import { setUpOnTabRemoveListeners } from "./background-script/tab-remove-listeners";
import { setUpBackgroundListeners } from "./utils/listener-helpers";
import { inIframe } from "./utils/iframe-helpers";
import { purgeOnStartup } from "./background-script/purge-on-startup";
import { setUpStorageChangeListeners } from "./content-script/storage-change-listeners";
import { setLocalStorage } from "./utils/storage-helpers";
import {
  isMellowtelStarted,
  startMellowtelWebsocket,
} from "./utils/start-stop-helpers";
import { getOptInStatus } from "./utils/opt-in-out-helpers";
import { checkRequiredPermissions } from "./utils/permission-helpers";
import { Logger } from "./logger/logger";

export default class Mellowtel {
  private publishableKey: string;
  private options?: any;
  private disableLogs: boolean = true;

  constructor(publishableKey: string, options?: any) {
    this.publishableKey = publishableKey;
    this.options = options;
    this.disableLogs =
      options?.disableLogs !== undefined ? options.disableLogs : true;
    Logger.disableLogs = this.disableLogs;
  }

  public async initBackground(
    auto_start_if_opted_in?: boolean | undefined,
    metadata_id?: string | undefined,
  ): Promise<void> {
    if (
      typeof this.publishableKey === "undefined" ||
      this.publishableKey === null ||
      this.publishableKey === ""
    ) {
      throw new Error("publishableKey is undefined, null, or empty");
    }
    await checkRequiredPermissions(false);
    await purgeOnStartup();
    await setUpOnTabRemoveListeners();
    await setUpBackgroundListeners();
    await getOrGenerateIdentifier(this.publishableKey);
    if (auto_start_if_opted_in === undefined || auto_start_if_opted_in) {
      let optInStatus = await getOptInStatus();
      if (optInStatus) {
        await this.start(metadata_id);
      }
    }
  }

  public async initContentScript(): Promise<void> {
    if (typeof window !== "undefined") {
      if (inIframe()) {
        const mutationObserverModule = await import(
          "./iframe/mutation-observer"
        );
        mutationObserverModule.attachMutationObserver();
      } else {
        if (await isMellowtelStarted()) {
          startMellowtelWebsocket();
        } else {
          await setUpStorageChangeListeners();
        }
      }
    }
  }

  public async optIn(): Promise<boolean> {
    return new Promise((resolve) => {
      setLocalStorage("mellowtelOptIn", "true").then(() => {
        resolve(true);
      });
    });
  }

  public async optOut(): Promise<boolean> {
    return new Promise((resolve) => {
      setLocalStorage("mellowtelOptIn", "false").then(() => {
        this.stop();
        resolve(true);
      });
    });
  }

  public async getOptInStatus(): Promise<boolean> {
    return getOptInStatus();
  }

  public async start(metadata_id?: string | undefined): Promise<boolean> {
    return new Promise(async (resolve) => {
      let optInStatus = await getOptInStatus();
      if (!optInStatus) {
        throw new Error(
          "Node has not opted in to Mellowtel yet. Request a disclaimer to the end-user and then call the optIn() method if they agree to join the Mellowtel network.",
        );
      }
      try {
        await checkRequiredPermissions(true);
        // note: in later version, metadata_id will be used to trace the #...
        // ...of requests to this specific node, so you can give rewards, etc.
        setLocalStorage("mellowtelStatus", "start").then(() => {
          resolve(true);
        });
      } catch (error) {
        await this.optOut();
        resolve(false);
      }
    });
  }

  public async stop(): Promise<boolean> {
    return new Promise((resolve) => {
      setLocalStorage("mellowtelStatus", "stop").then(() => {
        resolve(true);
      });
    });
  }
}
