import { entryEarnings, formatDateHuman, formatEuro } from "../lib/utils";
import { useLanguage } from "../context/LanguageContext";

export default function EntryList({ entries, onEdit, onDelete, emptyMessage, readOnly = false }) {
  const { t, lang } = useLanguage();

  if (!entries.length) {
    return (
      <div className="bg-panel border border-border rounded-xl2 p-8 text-center text-muted">
        {emptyMessage || t.dashboard.noEntries}
      </div>
    );
  }

  return (
    <div className="bg-panel border border-border rounded-xl2 shadow-card overflow-hidden">
      <div
        className={`hidden sm:grid gap-3 px-5 py-3 text-xs uppercase tracking-wide text-muted font-medium border-b border-border ${
          readOnly ? "grid-cols-[1fr,1fr,1fr,1fr,1fr]" : "grid-cols-[1fr,1fr,1fr,1fr,1fr,auto]"
        }`}
      >
        <span>{t.entryList.date}</span>
        <span>{t.entryList.delivered}</span>
        <span>{t.entryList.returns}</span>
        <span>{t.entryList.tips}</span>
        <span>{t.entryList.earnings}</span>
        {!readOnly && <span></span>}
      </div>
      <div className="divide-y divide-border">
        {entries.map((e) => (
          <div
            key={e.id}
            className={`grid grid-cols-2 gap-2 sm:gap-3 px-5 py-4 items-center hover:bg-panel2/60 transition ${
              readOnly ? "sm:grid-cols-[1fr,1fr,1fr,1fr,1fr]" : "sm:grid-cols-[1fr,1fr,1fr,1fr,1fr,auto]"
            }`}
          >
            <div className="col-span-2 sm:col-span-1">
              <div className="text-white font-semibold text-sm sm:text-base">
                {formatDateHuman(e.id, lang)}
              </div>
              <div className="text-muted text-xs sm:hidden">
                {t.entryList.rate} {Number(e.rate).toFixed(2)} €
              </div>
            </div>
            <div className="text-accent2 font-semibold">
              <span className="sm:hidden text-muted text-xs mr-1 font-normal">{t.entryList.delivered}:</span>
              {e.delivered}
            </div>
            <div className="text-danger font-semibold">
              <span className="sm:hidden text-muted text-xs mr-1 font-normal">{t.entryList.returns}:</span>
              {e.returns}
            </div>
            <div className="text-accent font-semibold">
              <span className="sm:hidden text-muted text-xs mr-1 font-normal">{t.entryList.tips}:</span>
              {formatEuro(e.tips || 0)}
            </div>
            <div className="text-white font-bold">
              <span className="sm:hidden text-muted text-xs mr-1 font-normal">{t.entryList.earnings}:</span>
              {formatEuro(entryEarnings(e))}
            </div>
            {!readOnly && (
              <div className="col-span-2 sm:col-span-1 flex gap-2 justify-end">
                <button
                  onClick={() => onEdit(e)}
                  className="text-xs font-semibold text-muted hover:text-accent border border-border hover:border-accent rounded-lg px-3 py-1.5 transition"
                >
                  {t.entryList.edit}
                </button>
                <button
                  onClick={() => onDelete(e)}
                  className="text-xs font-semibold text-muted hover:text-danger border border-border hover:border-danger rounded-lg px-3 py-1.5 transition"
                >
                  {t.entryList.delete}
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
