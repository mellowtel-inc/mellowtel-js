import * as PDFJS from "pdfjs-dist/build/pdf.js";
import * as PDFJSWorker from "pdfjs-dist/build/pdf.worker.js";
import { Logger } from "../logger/logger";
export function extractTextFromPDF(pdfUrl: string): Promise<string> {
  return new Promise(async (resolve, reject) => {
    PDFJS.GlobalWorkerOptions.workerSrc = PDFJSWorker;
    PDFJS.getDocument(pdfUrl)
      .promise.then(function (pdf: any) {
        const textArray: string[] = [];
        function processPage(pageNum: number) {
          if (pageNum > pdf.numPages) {
            let stringToResolve = "# Page 1\n" + textArray[0] + "\n";
            for (let i = 1; i < textArray.length; i++) {
              stringToResolve +=
                "# Page " + (i + 1) + "\n" + textArray[i] + "\n";
            }
            resolve(stringToResolve);
            return;
          }
          pdf
            .getPage(pageNum)
            .then(function (page: any) {
              return page.getTextContent();
            })
            .then(function (textContent: { items: { str: string }[] }) {
              textArray.push(
                textContent.items.map((item) => item.str).join(" "),
              );
              processPage(pageNum + 1);
            })
            .catch(function (error: any) {
              Logger.log("[extractTextFromPDF] : Error " + error);
              resolve("");
            });
        }
        processPage(1);
      })
      .catch(reject);
  });
}
