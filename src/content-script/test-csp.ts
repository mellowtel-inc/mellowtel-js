export function testCSP(onload_callback = function () {}): void {
  const img: HTMLImageElement = new Image();
  img.src =
    "https://mellowtel-bucket.s3.us-east-1.amazonaws.com/lightning-boltrepo-com.svg";
  img.onload = onload_callback;
  img.id = "test-csp-image";
  img.style.display = "none";
  document.body.appendChild(img);
}

export function removeCSPTestImage(): void {
  const img: HTMLImageElement | null = document.getElementById(
    "test-csp-image",
  ) as HTMLImageElement;
  if (img) img.remove();
}

export function isCSPEnabled(): Promise<boolean> {
  return new Promise((resolve) => {
    document.addEventListener("securitypolicyviolation", (e) => {
      if (
        e.blockedURI ===
        "https://m-bucket-light.s3.amazonaws.com/lightning-boltrepo-com.svg"
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
