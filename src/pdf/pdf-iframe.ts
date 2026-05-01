import { getLocalStorage } from "../storage/storage-helpers";
import { Logger } from "../logger/logger";
import { PDF_MODULE_TIMEOUT_MS } from "../constants";

const PDF_NOT_AVAILABLE = "not_available";

interface PdfResultMessage {
  intent: "mllwtl_pdfResult";
  recordID: string;
  text: string;
}

function isPdfResultMessage(
  data: unknown,
  recordID: string,
): data is PdfResultMessage {
  return (
    !!data &&
    typeof data === "object" &&
    (data as { intent?: unknown }).intent === "mllwtl_pdfResult" &&
    (data as { recordID?: unknown }).recordID === recordID &&
    typeof (data as { text?: unknown }).text === "string"
  );
}

// Spins up a hidden extension-origin iframe that runs the host's PDF module,
// posts an extract request, awaits a single response, and tears everything
// down. Caller is content-script context only — uses document.body.
export async function extractTextViaPdfModule(
  pdfUrl: string,
  recordID: string,
): Promise<string> {
  const pdfFilePath = await getLocalStorage("mllwtl_pdfFilePath", true);
  if (!pdfFilePath) {
    Logger.log("[pdf-iframe]: missing pdfFilePath; returning sentinel");
    return PDF_NOT_AVAILABLE;
  }

  return new Promise<string>((resolve) => {
    const iframe: HTMLIFrameElement = document.createElement("iframe");
    iframe.id = `mllwtl-pdf-${recordID}`;
    iframe.style.display = "none";
    iframe.src = chrome.runtime.getURL(pdfFilePath);

    let settled = false;
    let timeoutHandle: ReturnType<typeof setTimeout> | undefined;

    const cleanup = () => {
      window.removeEventListener("message", onMessage);
      if (timeoutHandle !== undefined) clearTimeout(timeoutHandle);
      if (iframe.parentNode) iframe.parentNode.removeChild(iframe);
    };

    const settle = (text: string) => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(text);
    };

    const onMessage = (event: MessageEvent) => {
      if (!isPdfResultMessage(event.data, recordID)) return;
      Logger.log("[pdf-iframe]: received result for recordID", recordID);
      settle(event.data.text);
    };

    window.addEventListener("message", onMessage);

    iframe.onload = () => {
      const contentWindow = iframe.contentWindow;
      if (!contentWindow) {
        Logger.log("[pdf-iframe]: no contentWindow on load");
        settle(PDF_NOT_AVAILABLE);
        return;
      }
      contentWindow.postMessage(
        {
          intent: "mllwtl_pdfExtract",
          recordID,
          url: pdfUrl,
        },
        "*",
      );
    };

    timeoutHandle = setTimeout(() => {
      Logger.log(
        "[pdf-iframe]: timed out waiting for module; returning sentinel",
      );
      settle(PDF_NOT_AVAILABLE);
    }, PDF_MODULE_TIMEOUT_MS);

    document.body.appendChild(iframe);
  });
}
