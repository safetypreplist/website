import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { loadImportedLists, saveImportedList, type ImportedChecklist } from "../lib/localStore";

export function ImportedListPage() {
  const { id } = useParams();
  const [list, setList] = useState<ImportedChecklist | null>(null);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    let live = true;
    void loadImportedLists().then((rows) => {
      if (!live) return;
      const found = rows.find((row) => row.id === id) || null;
      setList(found);
      setMissing(!found);
    });
    return () => {
      live = false;
    };
  }, [id]);

  async function toggle(itemId: string) {
    if (!list) return;
    const next: ImportedChecklist = {
      ...list,
      items: list.items.map((item) => (item.id === itemId ? { ...item, checked: !item.checked } : item)),
    };
    setList(next);
    await saveImportedList(next);
  }

  if (missing) {
    return (
      <div>
        <h1 className="page-title">Shared copy not found</h1>
        <p className="muted">That imported checklist is not on this device.</p>
        <Link className="btn btn-ghost" to="/app/lists">
          Back to lists
        </Link>
      </div>
    );
  }

  if (!list) return <p className="muted">Loading…</p>;

  return (
    <div className="list-page">
      <div className="list-toolbar">
        <Link className="btn btn-ghost" to="/app/lists">
          Back
        </Link>
      </div>
      <h1 className="page-title">{list.title}</h1>
      <p className="muted">
        Your own copy
        {list.sharedBy ? ` · shared by ${list.sharedBy}` : ""}. Saving here never changes the sender&apos;s list.
      </p>
      <ul className="checklist" style={{ marginTop: 18 }}>
        {list.items.map((item) => (
          <li key={item.id}>
            <label className="check-row">
              <input type="checkbox" checked={item.checked} onChange={() => void toggle(item.id)} />
              <span>{item.text}</span>
            </label>
            {item.note ? <p className="muted note-preview">{item.note}</p> : null}
          </li>
        ))}
      </ul>
    </div>
  );
}
