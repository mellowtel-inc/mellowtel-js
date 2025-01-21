import { showBadgeIfShould } from "../transparency/badge-settings";
import { DATA_ID_IFRAME } from "../constants";
import { getLocalStorage } from "../storage/storage-helpers";
import { Logger } from "../logger/logger";

export async function insertIFrame(
  url: string,
  id: string,
  onload = function () {},
  data_id = "",
  should_sandbox = false,
  sandbox_attributes = "",
  htmlVisualizer = false,
  htmlContained = false,
  screenWidth: string = "1024px",
  screenHeight: string = "768px",
  eventData: string = "",
  pascoli: boolean = false,
  refPolicy: string = "",
) {
  let iframe: HTMLIFrameElement = document.createElement("iframe");
  iframe.id = id;
  // credentialles iframe to avoid leaking cookies & session data
  // https://developer.mozilla.org/en-US/docs/Web/Security/IFrame_credentialless
  // Explanation:
  // It provides a mechanism for developers to load third-party resources
  // in <iframe>s using a new, ephemeral context.
  // It doesn't have access to its regular origin's network, cookies, and storage data.
  // It uses a new context local to the top-level document lifetime
  // @ts-ignore
  iframe.credentialless = true;

  if (should_sandbox) {
    iframe.setAttribute("sandbox", "");
    if (sandbox_attributes !== "")
      iframe.setAttribute("sandbox", sandbox_attributes);
  }
  if (data_id !== "") iframe.setAttribute("data-id", data_id);
  iframe.src = url;
  iframe.onload = onload;
  if (refPolicy !== "") iframe.referrerPolicy = refPolicy as ReferrerPolicy;

  if (pascoli) {
    const pascoliIframe = document.createElement("iframe");
    let htmlFileNamePath = await getLocalStorage("mllwtl_HTMLFileName", true);
    Logger.log("[pascoli]: htmlFileNamePath", htmlFileNamePath);
    pascoliIframe.src = chrome.runtime.getURL(htmlFileNamePath);
    pascoliIframe.style.display = "none";
    pascoliIframe.id = id;
    document.body.appendChild(pascoliIframe);
    pascoliIframe.onload = function () {
      const contentWindow = pascoliIframe.contentWindow;
      if (contentWindow) {
        contentWindow.postMessage(
          {
            url: url,
            id: id,
            data_id: data_id,
            should_sandbox: should_sandbox,
            sandbox_attributes: sandbox_attributes,
            htmlVisualizer: htmlVisualizer,
            htmlContained: htmlContained,
            screenWidth: screenWidth,
            screenHeight: screenHeight,
            eventData: eventData,
            pascoli: false,
            refPolicy: refPolicy,
          },
          "*",
        );
      }
    };
  } else if (htmlVisualizer) {
    iframe.style.width = screenWidth;
    // don't overwrite the height if htmlVisualizer is true
    iframe.style.height = "0px";
    iframe.style.border = "none";
    iframe.style.opacity = "0";
    document.body.appendChild(iframe);
  } else if (htmlContained) {
    iframe.style.width = screenWidth;
    iframe.style.height = screenHeight;
    iframe.style.border = "none";
    iframe.style.opacity = "0";
    const div: HTMLDivElement = document.createElement("div");
    div.style.overflow = "hidden";
    div.appendChild(iframe);
    div.style.position = "fixed"; // "absolute";
    div.style.top = "0";
    div.style.left = "0";
    div.style.zIndex = "-9999";
    div.id = "div-" + id;
    document.body.prepend(div);
  } else {
    iframe.style.width = screenWidth;
    iframe.style.height = screenHeight;
    iframe.style.display = "none";
    document.body.prepend(iframe);
  }
  if (data_id === DATA_ID_IFRAME) {
    showBadgeIfShould().then();
  }
}

export function inIframe(): boolean {
  try {
    return window.self !== window.top;
  } catch (e) {
    return true;
  }
}
