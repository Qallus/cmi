"use client";

import { useEffect, useState } from "react";

interface HeroCarouselProps {
  images: string[];
  interval?: number;
}

export function HeroCarousel({ images, interval = 5000 }: HeroCarouselProps) {
  const [current, setCurrent] = useState(0);
  const [prev, setPrev] = useState<number | null>(null);

  useEffect(() => {
    if (images.length <= 1) return;
    const id = setInterval(() => {
      setCurrent((c) => {
        setPrev(c);
        return (c + 1) % images.length;
      });
    }, interval);
    return () => clearInterval(id);
  }, [images.length, interval]);

  useEffect(() => {
    if (prev === null) return;
    const id = setTimeout(() => setPrev(null), 800);
    return () => clearTimeout(id);
  }, [prev]);

  return (
    <div className="absolute inset-0">
      {images.map((src, i) => (
        <img
          key={src}
          src={src}
          alt=""
          className="absolute inset-0 h-full w-full object-cover transition-opacity duration-700"
          style={{
            opacity: i === current ? 1 : i === prev ? 0 : 0,
            zIndex: i === current ? 1 : i === prev ? 0 : -1,
          }}
        />
      ))}
    </div>
  );
}
