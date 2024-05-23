const defaultSelectorsToRemove = [
  "nav",
  "footer",
  "script",
  "style",
  "noscript",
  "svg",
  '[role="alert"]',
  '[role="banner"]',
  '[role="dialog"]',
  '[role="alertdialog"]',
  '[role="region"][aria-label*="skip" i]',
  '[aria-modal="true"]',
];

export function removeSelectorsFromDocument(
  document: Document,
  selectorsToRemove: string[],
) {
  if (selectorsToRemove.length === 0)
    selectorsToRemove = defaultSelectorsToRemove;
  selectorsToRemove.forEach((selector) => {
    const elements = document.querySelectorAll(selector);
    elements.forEach((element) => element.remove());
  });
}

export function removeElementsByClassNames(classNamesToBeRemoved: string[]) {
  for (let i = 0; i < classNamesToBeRemoved.length; i++) {
    let className = classNamesToBeRemoved[i];
    let elements = document.getElementsByClassName(className);
    let elementsArray = Array.from(elements);
    for (let j = 0; j < elementsArray.length; j++) {
      let element = elementsArray[j];
      if (element) element.remove();
    }
  }
}

export function get_document_html(sep = "\n", document: Document) {
  let html = "";
  let xml = new XMLSerializer();
  for (let n of Array.from(document.childNodes)) {
    if (n.nodeType === Node.ELEMENT_NODE)
      if (n instanceof HTMLElement) {
        html += n.outerHTML + sep;
      } else html += xml.serializeToString(n) + sep;
  }
  return html;
}

export function removeImagesDOM(document: Document) {
  try {
    let images = Array.from(
      document.getElementsByTagName("img"),
    ) as HTMLImageElement[];
    images.forEach(function (img) {
      // iterate the images array
      img.parentNode?.removeChild(img); // remove the child node via the parent node
    });
  } catch (e) {}
}

export function removeElementIfPresent(element: HTMLElement | null) {
  if (element) element.remove();
}
