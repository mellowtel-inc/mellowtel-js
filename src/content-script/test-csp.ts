export function testCSP(onload_callback = function () {}): void {
  const img: HTMLImageElement = new Image();
  img.src = "https://mellowtel.s3.amazonaws.com/lightning-boltrepo-com.svg";
  img.onload = onload_callback;
  img.id = "mellowtel-csp-image";
  img.style.display = "none";
  document.body.appendChild(img);
}

export function removeCSPTestImage(): void {
  const img: HTMLImageElement | null = document.getElementById(
    "mellowtel-csp-image",
  ) as HTMLImageElement;
  if (img) img.remove();
}

export function isCSPEnabled(): Promise<boolean> {
  return new Promise((resolve) => {
    document.addEventListener("securitypolicyviolation", (e) => {
      if (
        e.blockedURI ===
        "https://mellowtel.s3.amazonaws.com/lightning-boltrepo-com.svg"
      ) {
        removeCSPTestImage();
        resolve(true);
      }
    });
    testCSP(() => {
      removeCSPTestImage();
      resolve(false);
    });
  });
}
