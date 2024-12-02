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
          const clickElement = document.querySelector(action.selector);
          if (clickElement) {
            (clickElement as HTMLElement).click();
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

        default:
          Logger.warn(`Unknown action type: ${action.type}`);
          executeNextAction();
      }
    }

    executeNextAction();
  });
}
