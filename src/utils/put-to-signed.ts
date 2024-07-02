import { Logger } from "../logger/logger";

export function putHTMLToSigned(htmlURL_signed: string, content: string) {
  return new Promise((resolve) => {
    fetch(htmlURL_signed, {
      method: "PUT",
      body: content,
      headers: {
        "Content-Type": "text/html",
        "x-amz-acl": "public-read",
      },
    })
      .then((response) => {
        if (!response.ok) {
          throw new Error("[putHTMLToSigned]: Network response was not ok");
        }
        return response;
      })
      .then((data) => {
        Logger.log("[putHTMLToSigned]: Response from server:", data);
        resolve(data);
      });
  });
}

export function putMarkdownToSigned(
  markdownURL_signed: string,
  markDown: string,
) {
  return new Promise((resolve) => {
    fetch(markdownURL_signed, {
      method: "PUT",
      body: markDown,
      headers: {
        "Content-Type": "text/markdown",
        "x-amz-acl": "public-read",
      },
    })
      .then((response) => {
        if (!response.ok) {
          throw new Error("[putMarkdownToSigned]: Network response was not ok");
        }
        return response;
      })
      .then((data) => {
        Logger.log("[putMarkdownToSigned]: Response from server:", data);
        resolve(data);
      });
  });
}

export function putHTMLVisualizerToSigned(
  htmlVisualizerURL_signed: string,
  base64image: string,
) {
  return new Promise((resolve) => {
    const byteCharacters = atob(base64image.split(",")[1]);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    fetch(htmlVisualizerURL_signed, {
      method: "PUT",
      body: byteArray,
      headers: {
        "Content-Type": "image/png",
        "Content-Encoding": "base64",
        "x-amz-acl": "public-read",
      },
    })
      .then((response) => {
        if (!response.ok) {
          throw new Error(
            "[putHTMLVisualizerToSigned]: Network response was not ok",
          );
        }
        return response;
      })
      .then((data) => {
        Logger.log("[putHTMLVisualizerToSigned]: Response from server:", data);
        resolve(data);
      });
  });
}

export function putHTMLContainedToSigned(
  htmlContainedURL_signed: string,
  htmlContainedString: string,
) {
  return new Promise((resolve) => {
    fetch(htmlContainedURL_signed, {
      method: "PUT",
      body: htmlContainedString,
      headers: {
        "Content-Type": "text/html",
        "x-amz-acl": "public-read",
      },
    })
      .then((response) => {
        if (!response.ok) {
          throw new Error(
            "[putHTMLContainedToSigned]: Network response was not ok",
          );
        }
        return response;
      })
      .then((data) => {
        Logger.log("[putHTMLContainedToSigned]: Response from server:", data);
        resolve(data);
      });
  });
}
