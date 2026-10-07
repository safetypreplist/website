import { useEffect, useState } from "react";
import { HERO_SLIDES } from "../lib/photos";

const SLIDE_MS = 5200;
const MOVE_MS = 1150;

export function HeroSlider() {
  const [index, setIndex] = useState(0);
  const [animate, setAnimate] = useState(true);
  const frames = [...HERO_SLIDES, HERO_SLIDES[0]];

  useEffect(() => {
    for (const slide of HERO_SLIDES) {
      const image = new Image();
      image.src = slide.src;
    }
  }, []);

  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) return;
    const timer = window.setInterval(() => {
      setAnimate(true);
      setIndex((current) => (current >= HERO_SLIDES.length ? 1 : current + 1));
    }, SLIDE_MS);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (index !== HERO_SLIDES.length) return;
    const timer = window.setTimeout(() => {
      setAnimate(false);
      setIndex(0);
    }, MOVE_MS);
    return () => window.clearTimeout(timer);
  }, [index]);

  return (
    <div className="hero-visual">
      <div
        className={animate ? "hero-slides" : "hero-slides hero-slides-instant"}
        style={{ transform: `translateX(-${index * 100}%)` }}
      >
        {frames.map((slide, frame) => {
          const looped = frame === HERO_SLIDES.length;
          return (
            <img
              className="hero-slide"
              src={slide.src}
              alt={looped ? "" : slide.alt}
              aria-hidden={looped || undefined}
              key={`${slide.src}-${frame}`}
            />
          );
        })}
      </div>
    </div>
  );
}
