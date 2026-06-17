"use client";

import * as React from "react";

const PLAYBACK_RATE = 0.75;
const VIDEO_STOP_SECONDS = 40;

export function HomeVideoBackground() {
  const iframeRef = React.useRef<HTMLIFrameElement | null>(null);
  const stopTimerRef = React.useRef<number | null>(null);

  const stopAtLimit = React.useCallback(() => {
    if (stopTimerRef.current) window.clearTimeout(stopTimerRef.current);
    stopTimerRef.current = window.setTimeout(() => {
      const target = iframeRef.current?.contentWindow;
      if (!target) return;
      target.postMessage(JSON.stringify({ event: "command", func: "pauseVideo", args: [] }), "*");
    }, (VIDEO_STOP_SECONDS / PLAYBACK_RATE) * 1000);
  }, []);

  const setPlaybackSpeed = React.useCallback(() => {
    const target = iframeRef.current?.contentWindow;
    if (!target) return;
    target.postMessage(JSON.stringify({ event: "command", func: "setPlaybackRate", args: [PLAYBACK_RATE] }), "*");
    target.postMessage(JSON.stringify({ event: "command", func: "playVideo", args: [] }), "*");
    stopAtLimit();
  }, [stopAtLimit]);

  React.useEffect(() => {
    const timer = window.setInterval(setPlaybackSpeed, 1200);
    window.setTimeout(() => window.clearInterval(timer), 9000);
    return () => {
      window.clearInterval(timer);
      if (stopTimerRef.current) window.clearTimeout(stopTimerRef.current);
    };
  }, [setPlaybackSpeed]);

  return (
    <iframe
      ref={iframeRef}
      src="https://www.youtube.com/embed/fyprwuHlCg8?autoplay=1&mute=1&controls=0&disablekb=1&modestbranding=1&playsinline=1&rel=0&start=0&end=40&enablejsapi=1"
      allow="autoplay; encrypted-media"
      onLoad={setPlaybackSpeed}
      className="absolute left-1/2 top-1/2 h-[100vh] min-h-full w-[177.78vh] min-w-full -translate-x-1/2 -translate-y-1/2 border-0"
      title="Constructed Matter project background video"
      aria-hidden="true"
    />
  );
}
