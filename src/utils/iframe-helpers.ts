export function injectHiddenIFrame(
  url: string,
  id: string,
  onload = function () {},
  width = "500px",
  data_id = "",
  should_sandbox = false,
  sandbox_attributes = "",
  htmlVisualizer = false,
) {
  let iframe: HTMLIFrameElement = document.createElement("iframe");
  iframe.id = id;
  // credentialles iframe to avoid leaking cookies & session data
  // https://developer.mozilla.org/en-US/docs/Web/Security/IFrame_credentialless
  // Experimental feature, not supported by all browsers
  // @ts-ignore
  iframe.credentialless = true;
  if (!htmlVisualizer) {
    iframe.style.width = width;
    iframe.style.height = "200px";
    iframe.style.display = "none";
  } else {
    iframe.style.width = "1800px";
    iframe.style.height = "0px";
    iframe.style.border = "none";
    iframe.style.opacity = "0";
  }
  if (should_sandbox) {
    iframe.setAttribute("sandbox", "");
    if (sandbox_attributes !== "")
      iframe.setAttribute("sandbox", sandbox_attributes);
  }
  if (data_id !== "") iframe.setAttribute("data-id", data_id);
  iframe.src = url;
  iframe.onload = onload;
  if (!htmlVisualizer) {
    document.body.prepend(iframe);
  } else {
    document.body.appendChild(iframe);
  }
}

export function inIframe(): boolean {
  try {
    return window.self !== window.top;
  } catch (e) {
    return true;
  }
}
