"use client";

import { useState } from "react";

interface HeroCarouselProps {
  images: string[];
}

export function HeroCarousel({ images }: HeroCarouselProps) {
  const [current] = useState(() => {
    if (images.length <= 1) return 0;
    return Math.floor(Math.random() * images.length);
  });

  const src = images[current] || images[0];
  if (!src) return null;

  return (
    <div className="absolute inset-0">
      <img src={src} alt="" className="absolute inset-0 h-full w-full object-cover" />
    </div>
  );
}
