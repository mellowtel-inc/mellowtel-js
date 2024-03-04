export function executeFunctionIfOrWhenBodyExists(func: Function): void {
  if (document.body) {
    func();
  } else {
    new MutationObserver((_, observer) => {
      const { body } = document;
      if (!body) return;
      observer.disconnect();
      func();
    }).observe(document.documentElement, { childList: true });
  }
}
