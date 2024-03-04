export function injectHiddenIFrame(
  url: string,
  id: string,
  onload = function () {},
  width = "500px",
  data_id = "",
  should_sandbox = false,
  sandbox_attributes = "",
) {
  let iframe: HTMLIFrameElement = document.createElement("iframe");
  iframe.id = id;
  // credentialles iframe to avoid leaking cookies & session data
  // https://developer.mozilla.org/en-US/docs/Web/Security/IFrame_credentialless
  // Experimental feature, not supported by all browsers
  // @ts-ignore
  iframe.credentialless = true;
  iframe.style.width = width;
  iframe.style.height = "200px";
  iframe.style.display = "none";
  if (should_sandbox) {
    iframe.setAttribute("sandbox", "");
    if (sandbox_attributes !== "")
      iframe.setAttribute("sandbox", sandbox_attributes);
  }
  if (data_id !== "") iframe.setAttribute("data-id", data_id);
  iframe.src = url;
  iframe.onload = onload;
  document.body.prepend(iframe);
}

export function inIframe(): boolean {
  try {
    return window.self !== window.top;
  } catch (e) {
    return true;
  }
}
