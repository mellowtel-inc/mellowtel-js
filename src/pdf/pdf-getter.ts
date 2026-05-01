import { Logger } from "../logger/logger";
import { isPdfModuleEnabled } from "./pdf-utils";
import { extractTextViaPdfModule } from "./pdf-iframe";

const PDF_NOT_AVAILABLE = "not_available";

function uint8ArrayToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

export async function extractTextFromPDF(
  pdfUrl: string,
  rawData: boolean = false,
  recordID: string = "",
): Promise<string> {
  if (rawData) {
    // base64 mode stays in core: pure fetch + btoa, no pdfjs-dist needed.
    const response = await fetch(pdfUrl);
    const arrayBuffer = await response.arrayBuffer();
    return uint8ArrayToBase64(new Uint8Array(arrayBuffer));
  }

  if (!(await isPdfModuleEnabled())) {
    Logger.log(
      "[extractTextFromPDF]: PDF module not configured; returning sentinel",
    );
    return PDF_NOT_AVAILABLE;
  }

  return extractTextViaPdfModule(pdfUrl, recordID);
}
