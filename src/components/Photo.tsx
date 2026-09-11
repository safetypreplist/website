import { PHOTO_LIBRARY, type PhotoSubject } from "../lib/photos";

type PhotoRatio = "square" | "portrait" | "wide" | "tall";
type PhotoAccent = "forest" | "moss" | "clay" | "terracotta";

const RATIOS: Record<PhotoRatio, string> = {
  square: "1 / 1",
  portrait: "4 / 5",
  wide: "16 / 9",
  tall: "3 / 4",
};

interface PhotoProps {
  alt: string;
  /** Real photograph URL. Overrides `subject` when set. */
  src?: string;
  /** Built-in photographic placeholder from the library. */
  subject?: PhotoSubject;
  ratio?: PhotoRatio;
  accent?: PhotoAccent;
  className?: string;
}

export function Photo({
  alt,
  src,
  subject,
  ratio = "wide",
  accent = "forest",
  className = "",
}: PhotoProps) {
  const image = src || (subject ? PHOTO_LIBRARY[subject] : undefined);
  const style = { aspectRatio: RATIOS[ratio] };

  if (image) {
    return (
      <div className={`photo ${className}`} style={style}>
        <img src={image} alt={alt} loading="lazy" />
      </div>
    );
  }

  return (
    <div
      className={`photo photo-placeholder accent-${accent} ${className}`}
      style={style}
      role="img"
      aria-label={alt}
    >
      <span className="photo-placeholder-label">{alt}</span>
    </div>
  );
}
