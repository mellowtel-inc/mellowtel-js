import { WebsiteJar } from "./expand-jar";
import { Logger } from "../logger/logger";
import { removeJarRulesForCookies } from "./create-jar";

export async function tellToApplyDistance(
  jarData: WebsiteJar,
  recordID: string,
  parsedBCrewObject: any,
  originalUrl: string,
): Promise<void> {
  return new Promise((resolve) => {
    Logger.log("[tellToApplyDistance] : Sending msg to apply distance");
    let waitBeforeApplyDistance = parsedBCrewObject.waitBeforeDistance || 0;

    setTimeout(() => {
      Logger.log(
        "[tellToApplyDistance] : Sending msg to apply distance after wait of " +
          waitBeforeApplyDistance,
      );
      let iframe: HTMLIFrameElement | null = document.getElementById(
        recordID,
      ) as HTMLIFrameElement | null;

      if (iframe) {
        iframe.onload = null;
        iframe.onload = function () {
          Logger.log("[tellToApplyDistance] : iframe loaded for second time");
          resolve();
        };
        iframe.contentWindow?.postMessage(
          {
            intent: "applyDistance",
            jarData: jarData,
            recordID: recordID,
            parsedBCrewObject: parsedBCrewObject,
            originalUrl: originalUrl,
          },
          "*",
        );
      } else {
        resolve();
      }
    }, waitBeforeApplyDistance);
  });
}

export async function applyDistance(
  jarData: WebsiteJar,
  recordID: string,
  parsedBCrewObject: any,
  originalUrl: string,
): Promise<void> {
  return new Promise(async (resolve) => {
    Logger.log("[applyDistance] : Applying distance");
    const nonHttpOnlyCookies = jarData.cookies.filter(
      (cookie) => !cookie.httpOnly,
    );

    nonHttpOnlyCookies.forEach((cookie) => {
      let cookieStr = `${cookie.name}=${cookie.value}; path=${cookie.path}`;

      if (cookie.domain) cookieStr += `; domain=${cookie.domain}`;
      if (cookie.secure) cookieStr += "; secure";

      if (!cookie.session && cookie.expirationDate) {
        const expirationDate = new Date(cookie.expirationDate * 1000);
        cookieStr += `; expires=${expirationDate.toUTCString()}`;
      }

      if (cookie.sameSite && cookie.sameSite !== "unspecified") {
        cookieStr += `; SameSite=${cookie.sameSite}`;
      } else {
        if (cookie.optionalDefaultValue) {
          cookieStr += `; ${cookie.optionalDefaultValue}`;
        }
        if (cookie.secure) {
          cookieStr += "; SameSite=None";
        }
      }

      document.cookie = cookieStr;
      Logger.log(`[applyDistance] Set cookie: ${cookieStr}`);
    });

    Object.entries(jarData.localStorage).forEach(([key, value]) => {
      try {
        localStorage.setItem(key, value);
        Logger.log(`[applyDistance] Set localStorage: ${key}`);
      } catch (error) {
        Logger.error(
          `[applyDistance] Error setting localStorage item ${key}:`,
          error,
        );
      }
    });

    Object.entries(jarData.sessionStorage).forEach(([key, value]) => {
      try {
        sessionStorage.setItem(key, value);
        Logger.log(`[applyDistance] Set sessionStorage: ${key}`);
      } catch (error) {
        Logger.error(
          `[applyDistance] Error setting sessionStorage item ${key}:`,
          error,
        );
      }
    });

    // await removeJarRulesForCookies(jarData.cookies);

    Logger.log("[applyDistance] Regoing to page to apply changes");
    window.location.href = originalUrl;
  });
}
