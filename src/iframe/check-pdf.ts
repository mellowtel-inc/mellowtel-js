export function isPdfEmbedElementPresent(): boolean {
  let embedElements: HTMLCollectionOf<HTMLEmbedElement> =
    document.getElementsByTagName("embed");
  for (let i = 0; i < embedElements.length; i++) {
    let currentElement = embedElements[i];
    if (currentElement.type === "application/pdf") {
      return true;
    }
  }
  return false;
}
