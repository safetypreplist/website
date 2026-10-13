export function ItemTip({
  open,
  text,
  onToggle,
}: {
  open: boolean;
  text: string;
  onToggle: () => void;
}) {
  return (
    <div className={`item-tip-wrap${open ? " open" : ""}`}>
      <button
        className={`item-tip${open ? " open" : ""}`}
        type="button"
        aria-label={open ? "Hide item details" : "Show item details"}
        aria-expanded={open}
        onClick={(event) => {
          event.stopPropagation();
          onToggle();
        }}
      >
        <span className="item-tip-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="9.25" fill="#fff" stroke="#c3c7bf" strokeWidth="1.5" />
            <circle cx="12" cy="8.1" r="1.15" fill="#5f6560" />
            <path d="M12 10.7v6.1" stroke="#5f6560" strokeWidth="1.7" strokeLinecap="round" />
          </svg>
        </span>
      </button>
      {open ? (
        <div className="item-pop info" role="tooltip">
          <span className="item-pop-kicker">Tip</span>
          {text}
        </div>
      ) : null}
    </div>
  );
}
