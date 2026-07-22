"use client";

import * as React from "react";

const VIDEO_ID = "fyprwuHlCg8";
const PLAYBACK_RATE = 0.75;
/** Seconds of source footage to use before looping back to the start. */
const VIDEO_LOOP_SECONDS = 30;
/** Wall-clock duration of one pass, since we play back slower than realtime. */
const LOOP_INTERVAL_MS = (VIDEO_LOOP_SECONDS / PLAYBACK_RATE) * 1000;

/**
 * Silent, looping background video.
 *
 * Two things keep YouTube's chrome off the screen:
 *  - No `loop`/`playlist` params. Those make the embed a playlist, which draws
 *    previous/next buttons even with `controls=0`. We loop with seekTo instead.
 *  - Commands are sent only after the player answers the `listening` handshake,
 *    and `playVideo`/`pauseVideo` are never sent at all — repeatedly poking a
 *    player that is already running flashes the big transport icons.
 * `autoplay=1&mute=1` starts playback on its own, so the only command we need
 * is the playback rate, plus a periodic seek back to the start.
 */
export function HomeVideoBackground() {
  const iframeRef = React.useRef<HTMLIFrameElement | null>(null);

  React.useEffect(() => {
    let ready = false;
    let handshakeTimer = 0;
    let loopTimer = 0;

    const post = (func: string, args: unknown[] = []) => {
      iframeRef.current?.contentWindow?.postMessage(
        JSON.stringify({ event: "command", func, args }),
        "*",
      );
    };

    const onMessage = (event: MessageEvent) => {
      if (ready) return;
      if (!/(^|\.)youtube(-nocookie)?\.com$/.test(new URL(event.origin).hostname)) return;
      if (event.source !== iframeRef.current?.contentWindow) return;

      ready = true;
      window.clearInterval(handshakeTimer);
      post("setPlaybackRate", [PLAYBACK_RATE]);
      // seekTo on a playing video keeps playing — no playVideo needed.
      loopTimer = window.setInterval(() => post("seekTo", [0, true]), LOOP_INTERVAL_MS);
    };

    window.addEventListener("message", onMessage);
    handshakeTimer = window.setInterval(() => {
      iframeRef.current?.contentWindow?.postMessage(
        JSON.stringify({ event: "listening", id: 1, channel: "widget" }),
        "*",
      );
    }, 400);

    return () => {
      window.removeEventListener("message", onMessage);
      window.clearInterval(handshakeTimer);
      window.clearInterval(loopTimer);
    };
  }, []);

  return (
    <iframe
      ref={iframeRef}
      src={`https://www.youtube.com/embed/${VIDEO_ID}?autoplay=1&mute=1&controls=0&disablekb=1&modestbranding=1&playsinline=1&rel=0&showinfo=0&iv_load_policy=3&fs=0&start=0&enablejsapi=1`}
      allow="autoplay; encrypted-media"
      // Full-bleed cover: fill the viewport width, then grow past it on tall
      // containers so the frame is never letterboxed.
      style={{ width: "100vw", height: "56.25vw", minHeight: "100%", minWidth: "177.78vh" }}
      className="pointer-events-none absolute left-1/2 top-1/2 max-w-none -translate-x-1/2 -translate-y-1/2 border-0"
      title="Constructed Matter project background video"
      aria-hidden="true"
      tabIndex={-1}
    />
  );
}
