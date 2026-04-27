import HeaderOperation = chrome.declarativeNetRequest.HeaderOperation;
import RuleActionType = chrome.declarativeNetRequest.RuleActionType;
import ResourceType = chrome.declarativeNetRequest.ResourceType;
import { sendMessageToBackground } from "../utils/messaging-helpers";
import {
  RULE_ID_IMAGE_RENDER,
  RULE_ID_POST_REQUEST,
  RULE_ID_XFRAME,
  RULE_ID_XHR_HEADERS_BASE,
  RULE_ID_XHR_HEADERS_MAX,
} from "../constants";
import { Logger } from "../logger/logger";
import { isInSW } from "../utils/utils";

export function disableXFrameHeaders(
  hostname: string,
  skipHeaders: boolean,
): Promise<boolean> {
  return new Promise(function (res) {
    if (skipHeaders) {
      res(false);
    } else {
      let ruleId = getRuleIdFromHostname(hostname);
      shouldDelegateDNR().then((delegate) => {
        if (delegate) {
          sendMessageToBackground({
            intent: "disableXFrameHeaders",
            hostname: hostname,
            skipHeaders: skipHeaders,
          }).then(() => {
            res(true);
          });
        } else {
          chrome.declarativeNetRequest.updateSessionRules({
            removeRuleIds: [ruleId],
            addRules: [
              {
                id: ruleId,
                priority: 1,
                action: {
                  type: "modifyHeaders" as RuleActionType,
                  responseHeaders: [
                    {
                      header: "x-frame-options",
                      operation: "remove" as HeaderOperation,
                    },
                    {
                      header: "content-security-policy",
                      operation: "remove" as HeaderOperation,
                    },
                    /*{
                      header: "X-Frame-Options",
                      operation: "remove" as HeaderOperation,
                    },
                    {
                      header: "Content-Security-Policy",
                      operation: "remove" as HeaderOperation,
                    },
                    {
                      header: "Frame-Options",
                      operation: "remove" as HeaderOperation,
                    },*/
                    {
                      header: "cross-origin-embedder-policy",
                      operation: "remove" as HeaderOperation,
                    },
                    {
                      header: "cross-origin-opener-policy",
                      operation: "remove" as HeaderOperation,
                    },
                    {
                      header: "cross-origin-resource-policy",
                      operation: "remove" as HeaderOperation,
                    },
                    {
                      header: "content-security-policy-report-only",
                      operation: "remove" as HeaderOperation,
                    },
                  ],
                },
                condition: {
                  resourceTypes: ["sub_frame" as ResourceType],
                  urlFilter: "*://*/*",
                  // `*${hostname}*`, --> specific filter disabled because
                  // there are internal redirects that need to be handled.
                  // Need to find a way to handle redirects and disable headers
                  // for all of them (while leaving them on for other sites).
                },
              },
            ],
          });
          res(true);
        }
      });
    }
  });
}

export function enableXFrameHeaders(hostname: string): Promise<boolean> {
  return new Promise(function (res) {
    let ruleId = getRuleIdFromHostname(hostname);
    shouldDelegateDNR().then((delegate) => {
      if (delegate) {
        sendMessageToBackground({
          intent: "enableXFrameHeaders",
          hostname: hostname,
        }).then(() => {
          res(true);
        });
      } else {
        chrome.declarativeNetRequest.updateSessionRules({
          removeRuleIds: [ruleId],
        });
        res(true);
      }
    });
  });
}

export function fixImageRenderHTMLVisualizer(): Promise<boolean> {
  return new Promise(function (res) {
    const rule = {
      id: RULE_ID_IMAGE_RENDER,
      priority: 1,
      action: {
        type: "modifyHeaders",
        requestHeaders: [
          {
            header: "Origin",
            operation: "remove",
          },
        ],
        responseHeaders: [
          {
            header: "Access-Control-Allow-Origin",
            operation: "set",
            value: "*",
          },
          {
            header: "Access-Control-Allow-Methods",
            operation: "set",
            value: "GET, POST, PUT, DELETE, OPTIONS",
          },
          {
            header: "Access-Control-Allow-Headers",
            operation: "set",
            value: "Content-Type",
          },
        ],
      },
      condition: {
        urlFilter: "*://*/*",
        resourceTypes: ["image"],
      },
    };
    // Add the dynamic rule
    chrome.declarativeNetRequest.updateSessionRules(
      {
        removeRuleIds: [RULE_ID_IMAGE_RENDER], // Clear any existing rules with the same ID to avoid duplicates
        addRules: [rule as any],
      },
      () => {
        if (chrome.runtime.lastError) {
          Logger.log("Error adding rule:", chrome.runtime.lastError);
          res(false);
        } else {
          Logger.log("Rule added successfully");
          res(true);
        }
      },
    );
  });
}

export function resetImageRenderHTMLVisualizer(): Promise<boolean> {
  return new Promise(function (res) {
    chrome.declarativeNetRequest.updateSessionRules({
      removeRuleIds: [RULE_ID_IMAGE_RENDER],
    });
    res(true);
  });
}

// Stable djb2-xor hash bounded to the reserved per-host XHR rule id range.
// Same host always returns the same id so install/cleanup agree without
// shared state. The modulo is bounded by [BASE, MAX] inclusive, which sits
// strictly between the singleton rules (80045-80050) and the BCREW range
// (>= RULE_ID_START_BCREW), so no overlap with other reserved ids is
// possible. See `src/constants.ts` for the full id layout.
export function ruleIdForXHRHost(host: string): number {
  let h = 5381;
  for (let i = 0; i < host.length; i++) {
    h = (((h << 5) + h) ^ host.charCodeAt(i)) | 0; // ToInt32: keep 32-bit signed
  }
  const slots = RULE_ID_XHR_HEADERS_MAX - RULE_ID_XHR_HEADERS_BASE + 1;
  return RULE_ID_XHR_HEADERS_BASE + (Math.abs(h) % slots);
}

// Build a host-anchored DNR urlFilter from a scrape URL. Returns null on a
// malformed URL so callers refuse to install the rule rather than fall back
// to the dangerous global wildcard.
export function buildXHRHostFilter(url: string): {
  filter: string;
  host: string;
} | null {
  try {
    const u = new URL(url);
    if (!u.host) return null;
    return { filter: `||${u.host}^`, host: u.host };
  } catch {
    return null;
  }
}

/**
 * Installs the per-host DNR rule that strips `Origin` and forces
 * `Access-Control-Allow-Origin: *` on all `xmlhttprequest`-typed requests
 * to the given URL's host. Used to bypass CORS on the scrape's own fetch.
 *
 * Despite the legacy "POST" wording in the previous name, this rule applies
 * to every XHR/fetch the scrape may issue (GET, POST, PUT, etc.) because
 * Chrome classifies all of them as `xmlhttprequest` for DNR purposes.
 */
export async function disableHeadersForXHR(url: string): Promise<boolean> {
  const parsed = buildXHRHostFilter(url);
  if (!parsed) {
    Logger.log(
      "[disableHeadersForXHR] invalid url, refusing to install rule:",
      url,
    );
    return false;
  }
  const ruleId = ruleIdForXHRHost(parsed.host);
  Logger.log(
    `[disableHeadersForXHR] host=${parsed.host} ruleId=${ruleId} filter=${parsed.filter}`,
  );
  await chrome.declarativeNetRequest.updateSessionRules({
    removeRuleIds: [ruleId],
    addRules: [
      {
        id: ruleId,
        priority: 1,
        action: {
          type: "modifyHeaders" as RuleActionType,
          requestHeaders: [
            {
              header: "Origin",
              operation: "remove" as HeaderOperation,
            },
          ],
          responseHeaders: [
            {
              header: "Access-Control-Allow-Origin",
              operation: "set" as HeaderOperation,
              value: "*",
            },
            {
              header: "Access-Control-Allow-Methods",
              operation: "set" as HeaderOperation,
              value: "GET, POST, PUT, DELETE, OPTIONS",
            },
            {
              header: "Access-Control-Allow-Headers",
              operation: "set" as HeaderOperation,
              value: "Content-Type",
            },
          ],
        },
        condition: {
          urlFilter: parsed.filter,
          resourceTypes: ["xmlhttprequest" as ResourceType],
        },
      },
    ],
  });
  return true;
}

/**
 * Removes the rule installed by `disableHeadersForXHR` for the given URL's
 * host. Reads the same URL → host → rule-id mapping at cleanup time, so the
 * install and cleanup paths agree without shared state.
 */
export async function enableHeadersForXHR(url: string): Promise<boolean> {
  const parsed = buildXHRHostFilter(url);
  if (!parsed) {
    // Without a URL we cannot derive the rule id we installed. Refuse to
    // touch DNR (silently removing rule id 0 is the orphan bug we are
    // trying to avoid).
    Logger.log(
      "[enableHeadersForXHR] invalid url, refusing no-op cleanup:",
      url,
    );
    return false;
  }
  const ruleId = ruleIdForXHRHost(parsed.host);
  Logger.log(
    `[enableHeadersForXHR] host=${parsed.host} ruleId=${ruleId}`,
  );
  await chrome.declarativeNetRequest.updateSessionRules({
    removeRuleIds: [ruleId],
  });
  return true;
}

export function getRuleIdFromHostname(hostname: string): number {
  // Disabled because a hostname can redirect to another hostname.
  // We need to disable the headers for the redirected hostname too.
  // TODO: Find a way to "map out" the redirects and disable the headers for all of them.
  /*
  let hashNumber = 0;
  for (let i = 0; i < hostname.length; i++) {
    hashNumber += hostname.charCodeAt(i);
  }
  return hashNumber;
  */
  return RULE_ID_XFRAME;
}

export function shouldDelegateDNR(): Promise<boolean> {
  return new Promise((resolve) => {
    try {
      chrome.declarativeNetRequest.getSessionRules((rules) => {
        if (chrome.runtime.lastError) {
          resolve(true);
        } else {
          resolve(false);
        }
      });
    } catch (error) {
      resolve(true);
    }
  });
}

export async function cleaunUpRules() {
  const isInServiceWorker = await isInSW();

  if (!isInServiceWorker) {
    await sendMessageToBackground({
      intent: "cleanUpDNRRules",
    });
    return;
  }

  // Sweep the legacy single id plus everything in the per-host XHR range.
  // This catches orphans from any prior SW lifetime, regardless of which
  // hosts they were installed for.
  const rules = await chrome.declarativeNetRequest.getSessionRules();
  const ids = rules
    .map((r) => r.id)
    .filter(
      (id) =>
        id === RULE_ID_POST_REQUEST ||
        (id >= RULE_ID_XHR_HEADERS_BASE && id <= RULE_ID_XHR_HEADERS_MAX),
    );
  if (ids.length) {
    Logger.log(`[cleaunUpRules] removing ${ids.length} XHR rule(s)`, ids);
    await chrome.declarativeNetRequest.updateSessionRules({
      removeRuleIds: ids,
    });
  }
}
