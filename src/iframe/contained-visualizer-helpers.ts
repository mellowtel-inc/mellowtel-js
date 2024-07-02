import { Logger } from "../logger/logger";

export function checkThroughFilters(
  url: string,
  second_document_string: string,
  orgId: string,
): Promise<boolean> {
  return new Promise((resolve) => {
    try {
      const endpointFilters =
        "https://5xpb4fkh75h5s4vngnzy6oowcy0cgahe.lambda-url.us-east-1.on.aws/";
      fetch(endpointFilters, {
        method: "POST",
        body: JSON.stringify({
          url: url,
          htmlContent: second_document_string,
          orgId: orgId,
        }),
      })
        .then((response) => {
          if (!response.ok) {
            throw new Error(
              "[checkThroughFilters]: Network response was not ok",
            );
          }
          return response.json();
        })
        .then((data) => {
          Logger.log("[checkThroughFilters]: Response from server:", data);
          resolve(data.valid);
        })
        .catch((error) => {
          Logger.error("[checkThroughFilters]: Error:", error);
          resolve(true);
        });
    } catch (error) {
      Logger.error(error);
      resolve(true);
    }
  });
}

export async function getS3SignedUrls(recordID: string): Promise<{
  uploadURL_htmlVisualizer: string;
  uploadURL_html: string;
  uploadURL_markDown: string;
  uploadURL_html_contained: string;
}> {
  return new Promise((resolve) => {
    fetch(
      "https://5xub3rkd3rqg6ebumgrvkjrm6u0jgqnw.lambda-url.us-east-1.on.aws/?recordID=" +
        recordID,
    )
      .then((response) => {
        if (!response.ok) {
          throw new Error("[getS3SignedUrl]: Network response was not ok");
        }
        return response.json();
      })
      .then((data) => {
        Logger.log("[getS3SignedUrl]: Response from server:", data);
        resolve({
          uploadURL_htmlVisualizer: data.uploadURL_htmlVisualizer,
          uploadURL_html: data.uploadURL_html,
          uploadURL_markDown: data.uploadURL_markDown,
          uploadURL_html_contained: data.uploadURL_html_contained,
        });
      });
  });
}
