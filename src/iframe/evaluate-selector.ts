export function getSelectorInfo(string_selector: string) {
  const replaceQuotes = (string: string) => {
    return string.replaceAll('"', "").replaceAll("'", "");
  };
  if (string_selector.includes("getElementById")) {
    return {
      dSelectorToUse: "getElementById",
      selectorId: replaceQuotes(
        string_selector.split("getElementById")[1].split("(")[1].split(")")[0],
      ),
      index: 0,
    };
  } else if (string_selector.includes("getElementsByClassName")) {
    let isThereClassNumber = string_selector.includes(")[");
    if (isThereClassNumber) {
      let classNumber = parseInt(string_selector.split(")[")[1].split("]")[0]);
      return {
        dSelectorToUse: "getElementsByClassName_withIndex",
        selectorId: replaceQuotes(
          string_selector
            .split("getElementsByClassName")[1]
            .split("(")[1]
            .split(")")[0],
        ),
        index: classNumber,
      };
    }
    return {
      dSelectorToUse: "getElementsByClassName",
      selectorId: replaceQuotes(
        string_selector
          .split("getElementsByClassName")[1]
          .split("(")[1]
          .split(")")[0],
      ),
      index: 0,
    };
  } else if (string_selector.includes("getElementsByTagName")) {
    return {
      dSelectorToUse: "getElementsByTagName",
      selectorId: replaceQuotes(
        string_selector
          .split("getElementsByTagName")[1]
          .split("(")[1]
          .split(")")[0],
      ),
      index: 0,
    };
  } else if (string_selector.includes("querySelector")) {
    return {
      dSelectorToUse: "querySelector",
      selectorId: replaceQuotes(
        string_selector.split("querySelector")[1].split("(")[1].split(")")[0],
      ),
      index: 0,
    };
  } else if (string_selector.includes("querySelectorAll")) {
    return {
      dSelectorToUse: "querySelectorAll",
      selectorId: replaceQuotes(
        string_selector
          .split("querySelectorAll")[1]
          .split("(")[1]
          .split(")")[0],
      ),
      index: 0,
    };
  }
}

export type DynamicSelector =
  | "getElementById"
  | "getElementsByClassName"
  | "getElementsByTagName"
  | "querySelector"
  | "querySelectorAll"
  | "getElementsByClassName_withIndex"
  | "getElementsByName";

export function waitForElementDynamicSelector(
  dSelectorToUse: DynamicSelector,
  selectorId: string,
  index: number = 0,
  timeout?: number,
): Promise<void> {
  return new Promise((resolve, reject) => {
    let timer: number | undefined;

    const checkElement = (): boolean => {
      switch (dSelectorToUse) {
        case "getElementById":
          return !!document.getElementById(selectorId);
        case "getElementsByClassName":
        case "getElementsByTagName":
        case "getElementsByName":
          return document[dSelectorToUse](selectorId).length > 0;
        case "querySelector":
          return !!document.querySelector(selectorId);
        case "querySelectorAll":
          return document.querySelectorAll(selectorId).length > 0;
        case "getElementsByClassName_withIndex":
          const elements = document.getElementsByClassName(selectorId);
          return elements.length > 0 && !!elements[index];
        default:
          return false;
      }
    };

    if (checkElement()) return resolve();

    const observer = new MutationObserver(() => {
      if (checkElement()) {
        observer.disconnect();
        if (timer) clearTimeout(timer);
        return resolve();
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });

    if (timeout) {
      timer = window.setTimeout(() => {
        observer.disconnect();
        reject(new Error("Timeout waiting for element"));
      }, timeout);
    }
  });
}
