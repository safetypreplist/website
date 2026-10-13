import { useId } from "react";

export type AccessLevel = "view" | "edit";

export function AccessChoice({
  name,
  value,
  onChange,
  disabled = false,
  compact = false,
}: {
  name: string;
  value: AccessLevel | null;
  onChange: (value: AccessLevel) => void;
  disabled?: boolean;
  compact?: boolean;
}) {
  const group = useId();
  const who = name.trim() || "this person";
  return (
    <fieldset className={`access-pick ${compact ? "is-compact" : ""}`} disabled={disabled}>
      <legend className="access-pick-label">
        What can <b>{who}</b> do with <b>your</b> checklist?
      </legend>
      <div className="access-pick-options">
        <label className={value === "view" ? "selected" : ""}>
          <input
            type="radio"
            name={group}
            value="view"
            checked={value === "view"}
            onChange={() => onChange("view")}
          />
          <span>
            <b>View only</b>
            <small>Can see your checklist, but can't change it</small>
          </span>
        </label>
        <label className={value === "edit" ? "selected" : ""}>
          <input
            type="radio"
            name={group}
            value="edit"
            checked={value === "edit"}
            onChange={() => onChange("edit")}
          />
          <span>
            <b>Can edit</b>
            <small>Can see and check off items on your checklist</small>
          </span>
        </label>
      </div>
    </fieldset>
  );
}
