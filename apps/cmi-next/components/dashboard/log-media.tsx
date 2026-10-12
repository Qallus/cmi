"use client";

// A daily log's photos (thumbnails, open full size) and voice notes (playable).
import * as React from "react";

export function LogMedia({ photos, attachments }: {
  photos?: string[] | null;
  attachments?: { url: string; type: string; name?: string | null }[] | null;
}) {
  const pics = (photos ?? []).filter(Boolean);
  const audio = (attachments ?? []).filter((a) => a?.type === "audio" && a.url);
  const video = (attachments ?? []).filter((a) => a?.type === "video" && a.url);
  if (!pics.length && !audio.length && !video.length) return null;
  return (
    <div className="mt-3 space-y-2">
      {audio.map((a, i) => <audio key={`${a.url}-${i}`} src={a.url} controls className="w-full max-w-md" />)}
      {video.map((v, i) => <video key={`${v.url}-${i}`} src={v.url} controls className="max-h-64 w-full max-w-md rounded-md border border-border" />)}
      {pics.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {pics.map((url) => (
            <a key={url} href={url} target="_blank" rel="noreferrer" className="block overflow-hidden rounded-md border border-border">
              {/* eslint-disable-next-line @next/next/no-img-element -- uploads from the public media bucket */}
              <img src={url} alt="Daily log photo" className="h-20 w-20 object-cover" />
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
