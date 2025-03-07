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
        // Remove the onload handler for this iframe to prevent future reloads from triggering it
        iframe.onload = null;
        // add an event listener to the iframe to listen for messages
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

    // Set non-HTTP-only cookies using JavaScript
    nonHttpOnlyCookies.forEach((cookie) => {
      let cookieStr = `${cookie.name}=${cookie.value}; path=${cookie.path}`;

      if (cookie.domain) cookieStr += `; domain=${cookie.domain}`;
      if (cookie.secure) cookieStr += "; secure";

      // Add expiration if not a session cookie
      if (!cookie.session && cookie.expirationDate) {
        const expirationDate = new Date(cookie.expirationDate * 1000);
        cookieStr += `; expires=${expirationDate.toUTCString()}`;
      }

      // Add SameSite attribute handling
      if (cookie.sameSite && cookie.sameSite !== "unspecified") {
        cookieStr += `; SameSite=${cookie.sameSite}`;
      } else {
        // AN OPTIONAL DEFAULT VALUE THAT WILL BE PASSED FROM THE JAR DATA
        if (cookie.optionalDefaultValue) {
          cookieStr += `; ${cookie.optionalDefaultValue}`;
        }
        // Default to SameSite=None for cross-site cookies
        if (cookie.secure) {
          cookieStr += "; SameSite=None";
        }
      }

      // Set the cookie
      document.cookie = cookieStr;
      Logger.log(`[applyDistance] Set cookie: ${cookieStr}`);
    });

    // Set localStorage items
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

    // Set sessionStorage items
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

    // Before refreshing, remove the rules.
    await removeJarRulesForCookies(jarData.cookies);

    // Refresh the page to apply all changes
    Logger.log("[applyDistance] Regoing to page to apply changes");
    window.location.href = originalUrl;
  });
}
