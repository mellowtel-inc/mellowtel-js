import { Logger } from "../logger/logger";

export interface FormField {
  name: string;
  value: string;
}

export interface Action {
  type: string;
  [key: string]: any;
}

export function executeActions(
  actions: Action[],
  document: Document,
): Promise<void> {
  return new Promise((resolve) => {
    let index = 0;

    function executeNextAction() {
      if (index >= actions.length) {
        resolve();
        return;
      }

      const action = actions[index];
      index++;

      switch (action.type) {
        case "wait":
          setTimeout(executeNextAction, action.milliseconds);
          break;

        case "click":
          const clickElement = document.querySelector<HTMLElement>(
            action.selector,
          );
          if (clickElement) {
            if (
              /**
               * Prevents triggering a download in the user's browser. See discussion: https://discord.com/channels/1221455179619106887/1221893620710375425/1325847913263267861
               *
               * If the crawler clicks on a link with the 'download' attribute, the browser doesn't open the file in a new tab. Instead, it tries to download the file.
               * This likely triggered a download in the user's browser. It also explains why this issue happens only rarely since the download attribute isn't commonly used.
               *
               * MDN: "The HTMLAnchorElement.download property is a string indicating that the linked resource is intended to be downloaded
               * rather than displayed in the browser."
               *
               *
               */
              clickElement instanceof HTMLAnchorElement &&
              clickElement.hasAttribute("download")
            ) {
              clickElement.removeAttribute("download");
            }

            clickElement.click();
          }
          executeNextAction();
          break;

        case "write":
          const activeElement = document.activeElement as
            | HTMLInputElement
            | HTMLTextAreaElement;
          if (activeElement && "value" in activeElement) {
            const start = activeElement.selectionStart || 0;
            const end = activeElement.selectionEnd || 0;
            activeElement.value =
              activeElement.value.substring(0, start) +
              action.text +
              activeElement.value.substring(end);
            activeElement.selectionStart = activeElement.selectionEnd =
              start + action.text.length;
          }
          executeNextAction();
          break;

        case "fill_input":
          const inputElement = document.querySelector(
            action.selector,
          ) as HTMLInputElement;
          if (inputElement) {
            inputElement.value = action.value;
          }
          executeNextAction();
          break;

        case "fill_textarea":
          const textareaElement = document.querySelector(
            action.selector,
          ) as HTMLTextAreaElement;
          if (textareaElement) {
            textareaElement.value = action.value;
          }
          executeNextAction();
          break;

        case "select":
          const selectElement = document.querySelector(
            action.selector,
          ) as HTMLSelectElement;
          if (selectElement) {
            selectElement.value = action.value;
          }
          executeNextAction();
          break;

        case "fill_form":
          const formElement = document.querySelector(
            action.selector,
          ) as HTMLFormElement;
          if (formElement) {
            const formData = new FormData(formElement);
            action.fields.forEach((field: FormField) => {
              formData.set(field.name, field.value);
            });
          }
          executeNextAction();
          break;

        case "press":
          const event = new KeyboardEvent("keydown", { key: action.key });
          document.dispatchEvent(event);
          executeNextAction();
          break;

        case "scroll":
          window.scrollBy({
            top: action.direction === "up" ? -action.amount : action.amount,
            left:
              action.direction === "left"
                ? -action.amount
                : action.direction === "right"
                  ? action.amount
                  : 0,
            behavior: "smooth",
          });
          executeNextAction();
          break;

        case "waitFor":
          Logger.log(
            "[executeNextAction] waiting for element",
            action.selector,
          );
          const timeout = action.timeout || 60000;
          const startTime = Date.now();
          function checkForElement() {
            const element = document.querySelector(action.selector);
            if (element) {
              Logger.log("[executeNextAction] element found!", action.selector);
              executeNextAction();
              return;
            }
            const elapsedTime = Date.now() - startTime;
            if (elapsedTime >= timeout) {
              Logger.warn(`Timeout waiting for selector: ${action.selector}`);
              executeNextAction();
              return;
            }
            setTimeout(checkForElement, 100);
          }
          checkForElement();
          break;

        case "real_input_g":
          const element = document.querySelector(action.selector);
          if (element && element.isContentEditable) {
            element.focus();

            const text = action.text || "";

            const selection = window.getSelection();

            if (selection && selection.rangeCount > 0) {
              const range = selection.getRangeAt(0);
              range.deleteContents();

              if (
                element.innerHTML.trim() === "" ||
                element.innerHTML === "<br>"
              ) {
                const paragraph = document.createElement("p");
                const textNode = document.createTextNode(text);
                paragraph.appendChild(textNode);
                element.innerHTML = "";
                element.appendChild(paragraph);
              } else {
                const textNode = document.createTextNode(text);
                range.insertNode(textNode);

                range.setStartAfter(textNode);
                range.setEndAfter(textNode);
                selection.removeAllRanges();
                selection.addRange(range);
              }
            } else {
              const paragraph =
                element.querySelector("p") || document.createElement("p");
              if (!paragraph.parentNode) {
                element.appendChild(paragraph);
              }
              paragraph.textContent = text;
            }

            if (element.classList.contains("ql-blank")) {
              element.classList.remove("ql-blank");
            }

            const inputEvent = new InputEvent("input", {
              bubbles: true,
              cancelable: true,
              inputType: "insertText",
              data: text,
            });
            element.dispatchEvent(inputEvent);
            const changeEvent = new Event("change", {
              bubbles: true,
              cancelable: true,
            });
            element.dispatchEvent(changeEvent);
          } else {
            Logger.warn(
              `Element for real_input not found or not contenteditable: ${action.selector}`,
            );
          }
          executeNextAction();
          break;
        default:
          Logger.warn(`Unknown action type: ${action.type}`);
          executeNextAction();
      }
    }

    executeNextAction();
  });
}
