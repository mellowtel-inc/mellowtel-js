import { showBadgeIfShould } from "../transparency/badge-settings";

export function injectHiddenIFrame(
  url: string,
  id: string,
  onload = function () {},
  width = "500px",
  data_id = "",
  should_sandbox = false,
  sandbox_attributes = "",
  htmlVisualizer = false,
  htmlContained = false,
) {
  let iframe: HTMLIFrameElement = document.createElement("iframe");
  iframe.id = id;
  // credentialles iframe to avoid leaking cookies & session data
  // https://developer.mozilla.org/en-US/docs/Web/Security/IFrame_credentialless
  // Experimental feature, not supported by all browsers
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
  iframe.referrerPolicy = "no-referrer";

  if (htmlVisualizer) {
    iframe.style.width = "1800px";
    iframe.style.height = "0px";
    iframe.style.border = "none";
    iframe.style.opacity = "0";
    document.body.appendChild(iframe);
  } else if (htmlContained) {
    iframe.style.width = "100vw";
    iframe.style.height = "600px";
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
    iframe.style.width = width;
    iframe.style.height = "200px";
    iframe.style.display = "none";
    document.body.prepend(iframe);
  }
  showBadgeIfShould().then();
}

export function inIframe(): boolean {
  try {
    return window.self !== window.top;
  } catch (e) {
    return true;
  }
}
