"use client";

import * as React from "react";

export function HomeVideoBackground() {
  const iframeRef = React.useRef<HTMLIFrameElement | null>(null);

  const setPlaybackSpeed = React.useCallback(() => {
    const target = iframeRef.current?.contentWindow;
    if (!target) return;
    target.postMessage(JSON.stringify({ event: "command", func: "setPlaybackRate", args: [0.75] }), "*");
    target.postMessage(JSON.stringify({ event: "command", func: "playVideo", args: [] }), "*");
  }, []);

  React.useEffect(() => {
    const timer = window.setInterval(setPlaybackSpeed, 1200);
    window.setTimeout(() => window.clearInterval(timer), 9000);
    return () => window.clearInterval(timer);
  }, [setPlaybackSpeed]);

  return (
    <iframe
      ref={iframeRef}
      src="https://www.youtube.com/embed/fyprwuHlCg8?autoplay=1&mute=1&controls=0&disablekb=1&modestbranding=1&playsinline=1&rel=0&loop=1&playlist=fyprwuHlCg8&enablejsapi=1"
      allow="autoplay; encrypted-media"
      onLoad={setPlaybackSpeed}
      className="absolute left-1/2 top-1/2 h-[100vh] min-h-full w-[177.78vh] min-w-full -translate-x-1/2 -translate-y-1/2 border-0"
      title="Constructed Matter project background video"
      aria-hidden="true"
    />
  );
}
