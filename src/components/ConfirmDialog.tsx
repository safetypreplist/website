import { FormEvent, ReactNode } from "react";

export function ConfirmDialog({
  title,
  body,
  confirmLabel,
  cancelLabel = "Cancel",
  danger = false,
  busy = false,
  onClose,
  onConfirm,
  children,
}: {
  title: string;
  body?: string;
  confirmLabel: string;
  cancelLabel?: string;
  danger?: boolean;
  busy?: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  children?: ReactNode;
}) {
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    await onConfirm();
  }

  return (
    <div
      className="modal-backdrop"
      onClick={() => {
        if (!busy) onClose();
      }}
      role="presentation"
    >
      <div
        className="modal-panel sheet-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        onClick={(event) => event.stopPropagation()}
      >
        <button className="modal-close" type="button" onClick={onClose} disabled={busy}>
          Close
        </button>
        <h2 id="confirm-dialog-title">{title}</h2>
        {body ? <p className="muted">{body}</p> : null}
        <form onSubmit={(event) => void submit(event)}>
          {children}
          <div className="toolbar" style={{ marginTop: 18 }}>
            <button className="btn btn-ghost" type="button" onClick={onClose} disabled={busy}>
              {cancelLabel}
            </button>
            <button className={`btn ${danger ? "btn-danger" : "btn-primary"}`} type="submit" disabled={busy}>
              {busy ? "Working…" : confirmLabel}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
