export function muteIframe(): void {
  // For iframes, we don't want to play any audio or video
  // Mute and pause all existing video and audio elements
  const videos: HTMLCollectionOf<HTMLVideoElement> =
    document.getElementsByTagName("video");
  const audios: HTMLCollectionOf<HTMLAudioElement> =
    document.getElementsByTagName("audio");

  for (let i = 0; i < videos.length; i++) {
    videos[i].muted = true;
    videos[i].pause();
  }

  for (let i = 0; i < audios.length; i++) {
    audios[i].muted = true;
    audios[i].pause();
  }

  new MutationObserver((mutationsList, _observer) => {
    // Iterate over all mutations that just occurred
    for (const mutation of mutationsList) {
      // If the addedNodes property has one or more nodes
      for (let i = 0; i < mutation.addedNodes.length; i++) {
        const addedNode = mutation.addedNodes[i];
        // Check if the added node is an Element and if it's a video or audio element
        if (
          addedNode instanceof Element &&
          (addedNode.tagName === "VIDEO" || addedNode.tagName === "AUDIO")
        ) {
          // If so, mute and pause the media element
          (addedNode as HTMLMediaElement).muted = true;
          (addedNode as HTMLMediaElement).pause();
        }
      }
    }
  }).observe(document, { childList: true, subtree: true });
}
