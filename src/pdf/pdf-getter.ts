export function extractTextFromPDF(
  pdfUrl: string,
  rawData: boolean = false,
): Promise<string> {
  return new Promise(async (resolve, reject) => {
    if (rawData) {
      fetch(pdfUrl)
        .then((response) => response.arrayBuffer())
        .then((arrayBuffer) => {
          const bytes = new Uint8Array(arrayBuffer);
          let binary = "";
          for (let i = 0; i < bytes.length; i++) {
            binary += String.fromCharCode(bytes[i]);
          }
          const base64String = btoa(binary);
          resolve(base64String);
        })
        .catch(reject);
    } else {
      resolve("not-implemented");
    }
  });
}
