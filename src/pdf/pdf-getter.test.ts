import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { extractTextFromPDF } from "./pdf-getter";

function makeMinimalPdf(text: string): Uint8Array {
  const objs: string[] = [];
  objs[0] = `<< /Type /Catalog /Pages 2 0 R >>`;
  objs[1] = `<< /Type /Pages /Kids [3 0 R] /Count 1 >>`;
  objs[2] =
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] ` +
    `/Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>`;
  const stream = `BT /F1 24 Tf 100 700 Td (${text}) Tj ET`;
  objs[3] = `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`;
  objs[4] = `<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>`;

  let pdf = "%PDF-1.4\n";
  const offsets: number[] = [];
  for (let i = 0; i < objs.length; i++) {
    offsets.push(pdf.length);
    pdf += `${i + 1} 0 obj\n${objs[i]}\nendobj\n`;
  }
  const xrefOffset = pdf.length;
  pdf += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n`;
  for (const off of offsets) {
    pdf += `${String(off).padStart(10, "0")} 00000 n \n`;
  }
  pdf +=
    `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\n` +
    `startxref\n${xrefOffset}\n%%EOF\n`;

  return new TextEncoder().encode(pdf);
}

function mockFetchOnceWithBytes(bytes: Uint8Array) {
  const response = {
    arrayBuffer: async () =>
      bytes.buffer.slice(
        bytes.byteOffset,
        bytes.byteOffset + bytes.byteLength,
      ),
  };
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => response as unknown as Response),
  );
}

describe("extractTextFromPDF — base64 mode (rawData: true)", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  test("returns base64 of the fetched bytes", async () => {
    const bytes = new Uint8Array([0x68, 0x65, 0x6c, 0x6c, 0x6f]); // "hello"
    mockFetchOnceWithBytes(bytes);

    const result = await extractTextFromPDF("https://example.com/x.pdf", true);

    expect(result).toBe("aGVsbG8="); // btoa("hello")
  });

  test("preserves all byte values including non-printable bytes", async () => {
    const bytes = new Uint8Array([0x00, 0xff, 0x7f, 0x80, 0x01]);
    mockFetchOnceWithBytes(bytes);

    const result = await extractTextFromPDF("https://example.com/x.pdf", true);
    const decoded = Uint8Array.from(atob(result), (c) => c.charCodeAt(0));

    expect(Array.from(decoded)).toEqual(Array.from(bytes));
  });
});

describe("extractTextFromPDF — text extraction mode (rawData: false)", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  test("extracts text from a valid PDF and prefixes each page with '# Page N'", async () => {
    const pdf = makeMinimalPdf("Hello World");
    mockFetchOnceWithBytes(pdf);

    const result = await extractTextFromPDF("https://example.com/x.pdf");

    expect(result).toContain("# Page 1");
    expect(result).toContain("Hello World");
  });

  test("defaults rawData to false (returns extracted text, not base64)", async () => {
    const pdf = makeMinimalPdf("Hello World");
    mockFetchOnceWithBytes(pdf);

    const result = await extractTextFromPDF("https://example.com/x.pdf");

    expect(result.startsWith("# Page 1")).toBe(true);
  });

  test("resolves to '' when PDF parsing throws (invalid bytes)", async () => {
    const garbage = new TextEncoder().encode("definitely-not-a-pdf");
    mockFetchOnceWithBytes(garbage);

    const result = await extractTextFromPDF("https://example.com/bad.pdf");

    expect(result).toBe("");
  });
});

describe("extractTextFromPDF — failure modes", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  test("rejects when fetch itself fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("network down");
      }),
    );

    await expect(
      extractTextFromPDF("https://example.com/x.pdf"),
    ).rejects.toThrow("network down");
  });
});

// End-to-end test against a real PDF served over the public internet. Skip
// with SKIP_LIVE_PDF=1 if the test machine is offline or sandboxed. The URL
// points at Mozilla's own pdf.js test fixture — extremely stable, hosted on
// GitHub Pages, and guaranteed parseable by pdfjs-dist.
const LIVE_PDF_URL =
  "https://mozilla.github.io/pdf.js/web/compressed.tracemonkey-pldi-09.pdf";
const skipLive = process.env.SKIP_LIVE_PDF === "1";

describe.skipIf(skipLive)("extractTextFromPDF — live network", () => {
  // pdfjs-dist's legacy build emits noisy stderr warnings about
  // `standardFontDataUrl` when running in Node. The warnings are harmless
  // (text extraction still succeeds) but they pollute test output.
  beforeEach(() => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "log").mockImplementation(() => {});
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  test(
    "fetches and extracts text from a real PDF over HTTPS",
    async () => {
      const result = await extractTextFromPDF(LIVE_PDF_URL);

      // Page-segmented output structure
      expect(result).toMatch(/^# Page 1\n/);
      expect(result).toContain("# Page 2");

      // Known content from the TraceMonkey paper. Loose match — we only need
      // proof that real text was extracted, not exact-string fidelity.
      expect(result.toLowerCase()).toMatch(/trace|javascript|dynamic/);

      // Sanity: more than just the page headers
      expect(result.length).toBeGreaterThan(1000);
    },
    30_000,
  );

  test(
    "returns base64 of the same PDF when rawData=true",
    async () => {
      const result = await extractTextFromPDF(LIVE_PDF_URL, true);

      // Valid base64 (no whitespace, only base64 alphabet, optional padding)
      expect(result).toMatch(/^[A-Za-z0-9+/]+=*$/);

      // Decoded prefix should be the PDF magic header
      const decodedPrefix = atob(result.slice(0, 12));
      expect(decodedPrefix.startsWith("%PDF-")).toBe(true);
    },
    30_000,
  );
});

describe("extractTextFromPDF — security hardening", () => {
  test("source enables CVE-2024-4367 mitigations on getDocument", () => {
    const source = readFileSync(
      resolve(__dirname, "pdf-getter.ts"),
      "utf8",
    );

    expect(source).toMatch(/isEvalSupported:\s*false/);
    expect(source).toMatch(/disableWorker:\s*true/);
    expect(source).toMatch(/disableAutoFetch:\s*true/);
    expect(source).toMatch(/disableStream:\s*true/);
  });

  test("imports the legacy build (Node + older-runtime safe)", () => {
    const source = readFileSync(
      resolve(__dirname, "pdf-getter.ts"),
      "utf8",
    );

    expect(source).toContain("pdfjs-dist/legacy/build/pdf.mjs");
  });
});
