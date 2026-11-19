import { avatarColorFrom } from "../lib/localProfile";
import { initialsFrom } from "../lib/identity";

type Props = {
  className?: string;
  name?: string | null;
  avatarUrl?: string | null;
  alt?: string;
};

/** Shared photo-or-initials mark used in header, checklist, and dashboard. */
export function ProfileAvatar({ className, name, avatarUrl, alt = "" }: Props) {
  const label = name?.trim() || "";
  const initials = initialsFrom(label || null);

  if (avatarUrl) {
    return (
      <span className={className}>
        <img src={avatarUrl} alt={alt} />
      </span>
    );
  }

  return (
    <span
      className={className}
      style={{ background: avatarColorFrom(label || initials), color: "#F4F0E5" }}
      aria-hidden={alt ? undefined : true}
    >
      <span>{initials}</span>
    </span>
  );
}
