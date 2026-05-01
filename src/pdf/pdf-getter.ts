import { Logger } from "../logger/logger";

// pdfjs-dist v5 is ESM-only. tsup's esbuild emit (and Vite under Vitest)
// preserves native `import()` calls in both CJS and ESM outputs, so a plain
// dynamic import is safe here regardless of tsconfig's module setting.
function loadPdfjs(): Promise<any> {
  return import("pdfjs-dist/legacy/build/pdf.mjs");
}

function uint8ArrayToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

async function extractTextFromBytes(bytes: Uint8Array): Promise<string> {
  const PDFJS = await loadPdfjs();

  // Hardening: isEvalSupported:false defuses CVE-2024-4367 even on patched
  // versions. disableWorker:true keeps everything on the main thread so the
  // SDK does not need to ship a separate worker file via web_accessible_resources.
  const pdf = await PDFJS.getDocument({
    data: bytes,
    isEvalSupported: false,
    disableAutoFetch: true,
    disableStream: true,
    disableWorker: true,
  }).promise;

  const pageTexts: string[] = [];
  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const textContent = await page.getTextContent();
    const pageText = textContent.items
      .map((item: { str?: string }) => item.str ?? "")
      .join(" ");
    pageTexts.push(pageText);
  }

  return pageTexts
    .map((text, idx) => `# Page ${idx + 1}\n${text}\n`)
    .join("");
}

export function extractTextFromPDF(
  pdfUrl: string,
  rawData: boolean = false,
): Promise<string> {
  return new Promise(async (resolve, reject) => {
    try {
      const response = await fetch(pdfUrl);
      const arrayBuffer = await response.arrayBuffer();
      const bytes = new Uint8Array(arrayBuffer);

      if (rawData) {
        resolve(uint8ArrayToBase64(bytes));
        return;
      }

      try {
        const text = await extractTextFromBytes(bytes);
        console.log("[extractTextFromPDF] : Extracted text length: " + text);
        resolve(text);
      } catch (parseError) {
        Logger.log("[extractTextFromPDF] : Error " + parseError);
        resolve("");
      }
    } catch (fetchError) {
      reject(fetchError);
    }
  });
}
