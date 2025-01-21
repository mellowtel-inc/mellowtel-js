import {
  getExtensionIdentifier,
  getOrGenerateIdentifier,
} from "./utils/identity-helpers";
import { setUpOnTabRemoveListeners } from "./background-script/tab-remove-listeners";
import { setUpBackgroundListeners } from "./listeners/listener-helpers-SW";
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
import { checkRequiredPermissions } from "./permissions/permission-helpers";
import { MAX_DAILY_RATE as DEFAULT_MAX_DAILY_RATE, VERSION } from "./constants";
import { Logger } from "./logger/logger";
import { RateLimiter } from "./local-rate-limiting/rate-limiter";
import { setUpExternalMessageListeners } from "./elements/web-platform";
import {
  generateOptInLink,
  generateSettingsLink,
  openUserSettingsInPopupWindow,
  generateAndOpenOptInLink,
  generateUpdateLink,
  generateAndOpenUpdateLink,
  generateFeedbackLink,
  generateAndOpenFeedbackLink,
} from "./elements/generate-links";
import { detectBrowser } from "./utils/utils";
import { switchShouldContinue } from "./switch/check-switch";
import { setLocalStorage } from "./storage/storage-helpers";
import { initializePascoli } from "./pascoli/pascoli-index";

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
    let shouldContinue: boolean = await switchShouldContinue();
    if (shouldContinue) {
      Logger.log("[initBackground]: Switch is on. Continuing.");
      if (auto_start_if_opted_in === undefined || auto_start_if_opted_in) {
        let optInStatus: boolean = (await getOptInStatus()).boolean;
        if (optInStatus) {
          await start(metadata_id);
          // keep service worker alive
        }
      }
    } else {
      Logger.log("[initBackground]: Switch is off. Not continuing.");
    }
  }

  public async initContentScript(
    pascoliHTMLFileName?: string | undefined,
  ): Promise<void> {
    if (typeof pascoliHTMLFileName !== "undefined") {
      await setLocalStorage("mllwtl_HTMLFileName", pascoliHTMLFileName);
    }
    if (typeof window !== "undefined") {
      await setUpExternalMessageListeners();
    }
    if (typeof window !== "undefined") {
      if (inIframe()) {
        const mutationObserverModule = await import(
          "./iframe/mutation-observer"
        );
        mutationObserverModule.listenerAlive();
        mutationObserverModule.attachMutationObserver();
      } else {
        let shouldContinue: boolean = await switchShouldContinue();
        if (shouldContinue) {
          Logger.log("[initContentScript]: Switch is on. Continuing.");

          if ((await isStarted()) && (await getOptInStatus())) {
            startWebsocket();
          } else {
            await setUpStorageChangeListeners();
          }
        } else {
          Logger.log("[initContentScript]: Switch is off. Not continuing.");
        }
      }
    }
  }

  public async initPascoli(): Promise<void> {
    if (typeof window !== "undefined") {
      await initializePascoli();
    }
  }

  public async optIn(): Promise<boolean> {
    return optIn();
  }

  public async optOut(): Promise<boolean> {
    return optOut();
  }

  public async getOptInStatus(): Promise<boolean> {
    return (await getOptInStatus()).boolean;
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

  public async generateUpdateLink(): Promise<string> {
    return generateUpdateLink();
  }

  public async generateAndOpenUpdateLink(): Promise<string> {
    return generateAndOpenUpdateLink();
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

  public async getBrowser(): Promise<string> {
    return detectBrowser();
  }

  public async start(metadata_id?: string | undefined): Promise<boolean> {
    return start(metadata_id);
  }

  public async stop(): Promise<boolean> {
    return stop();
  }

  public async generateFeedbackLink(): Promise<string> {
    return generateFeedbackLink();
  }

  public async generateAndOpenFeedbackLink(): Promise<string> {
    return generateAndOpenFeedbackLink();
  }
}
