import { useEffect, useRef, useState } from "react";

export function StoryVideo() {
  const [mobile, setMobile] = useState(() => window.matchMedia("(max-width: 899px)").matches);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const query = window.matchMedia("(max-width: 899px)");
    const sync = () => setMobile(query.matches);
    sync();
    query.addEventListener("change", sync);
    return () => query.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !mobile) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      video.pause();
      return;
    }
    void video.play().catch(() => undefined);
  }, [mobile]);

  if (!mobile) return null;

  return (
    <video
      className="story-video"
      ref={videoRef}
      src="/videos/safety.mp4"
      poster="/images/family-packing-car.jpg"
      autoPlay
      muted
      loop
      playsInline
      aria-label="Family packing a vehicle with emergency supplies"
    />
  );
}
