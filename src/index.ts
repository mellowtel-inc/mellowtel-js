import {
  getExtensionIdentifier,
  getOrGenerateIdentifier,
} from "./utils/identity-helpers";
import { setUpOnTabRemoveListeners } from "./background-script/tab-remove-listeners";
import { setUpBackgroundListeners } from "./utils/listener-helpers";
import { inIframe } from "./utils/iframe-helpers";
import { purgeOnStartup } from "./background-script/purge-on-startup";
import { setUpStorageChangeListeners } from "./content-script/storage-change-listeners";
import {
  isStarted,
  start,
  startWebsocket,
  stop,
} from "./utils/start-stop-helpers";
import { getOptInStatus, optIn, optOut } from "./utils/opt-in-out-helpers";
import { checkRequiredPermissions } from "./utils/permission-helpers";
import {
  MAX_DAILY_RATE as DEFAULT_MAX_DAILY_RATE,
  VERSION,
} from "./constants";
import { Logger } from "./logger/logger";
import { RateLimiter } from "./local-rate-limiting/rate-limiter";
import { setUpExternalMessageListeners } from "./elements/web-platform";
import {
  generateOptInLink,
  generateSettingsLink,
  openUserSettingsInPopupWindow,
  generateAndOpenOptInLink,
} from "./elements/generate-links";

export default class M {
  private publishableKey: string;
  private options?: any;
  private disableLogs: boolean = true;
  private MAX_DAILY_RATE: number = DEFAULT_MAX_DAILY_RATE;

  constructor(publishableKey: string, options?: any) {
    this.publishableKey = publishableKey;
    this.options = options;
    this.disableLogs =
      options?.disableLogs !== undefined ? options.disableLogs : true;
    this.MAX_DAILY_RATE = options?.MAX_DAILY_RATE || DEFAULT_MAX_DAILY_RATE;
    RateLimiter.MAX_DAILY_RATE = this.MAX_DAILY_RATE;
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
      await setUpExternalMessageListeners();
      if (inIframe()) {
        const mutationObserverModule = await import(
          "./iframe/mutation-observer"
        );
        mutationObserverModule.listenerAlive();
        mutationObserverModule.attachMutationObserver();
      } else {
        if ((await isStarted()) && (await getOptInStatus())) {
          startWebsocket();
        } else {
          await setUpStorageChangeListeners();
        }
      }
    }
  }

  public async optIn(): Promise<boolean> {
    return optIn();
  }

  public async optOut(): Promise<boolean> {
    return optOut();
  }

  public async getOptInStatus(): Promise<boolean> {
    return getOptInStatus();
  }

  public async generateOptInLink(): Promise<string> {
    return generateOptInLink();
  }

  public async generateAndOpenOptInLink(): Promise<string> {
    return generateAndOpenOptInLink();
  }

  public async generateSettingsLink(): Promise<string> {
    return generateSettingsLink();
  }

  public async openUserSettingsInPopupWindow(): Promise<boolean> {
    return openUserSettingsInPopupWindow();
  }

  public async getNodeId(): Promise<string> {
    return getOrGenerateIdentifier(this.publishableKey);
  }

  public async getVersion(): Promise<string> {
    return VERSION;
  }

  public async getExtensionIdentifier(): Promise<string> {
    return getExtensionIdentifier();
  }

  public async start(metadata_id?: string | undefined): Promise<boolean> {
    return start(metadata_id);
  }

  public async stop(): Promise<boolean> {
    return stop();
  }
}
