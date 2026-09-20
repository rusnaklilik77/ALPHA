import { useEffect, useState } from "react";
import { todayStr, formatEuro } from "../lib/utils";
import { useLanguage } from "../context/LanguageContext";

// Форма сортировщика: нет посылок и возвратов — только дата и отработанные
// часы. Заработок за день = часы × ставка за час (ставка — в шапке).
const QUICK_HOURS = [4, 6, 8, 10, 12];

export default function SorterEntryForm({ rate, onSubmit, existing, onCancel }) {
  const { t } = useLanguage();
  const [date, setDate] = useState(existing?.id || todayStr());
  const [hours, setHours] = useState(existing?.hours ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (existing) {
      setDate(existing.id);
      setHours(existing.hours ?? "");
      setError("");
    }
  }, [existing]);

  const hoursNum = Number(String(hours).replace(",", ".")) || 0;
  const preview = hoursNum * Number(rate || 0);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!(hoursNum >= 0.25 && hoursNum <= 24)) {
      setError(t.sorterForm.hoursInvalid);
      return;
    }
    setError("");
    setBusy(true);
    try {
      await onSubmit({ date, hours: hoursNum });
      if (!existing) setHours("");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="bg-panel border border-border rounded-xl2 shadow-card p-5">
      <h3 className="text-white font-bold mb-1">{existing ? t.sorterForm.editTitle : t.sorterForm.addTitle}</h3>
      <p className="text-muted text-xs mb-4">{t.sorterForm.hint}</p>

      <div className="grid grid-cols-2 gap-4 max-w-md">
        <div>
          <label className="block text-xs font-medium text-muted mb-1.5">{t.sorterForm.date}</label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            max={todayStr()}
            required
            className="w-full bg-panel2 border border-border rounded-lg px-3 py-2.5 text-white outline-none focus:border-accent transition"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-muted mb-1.5">{t.sorterForm.hours}</label>
          <input
            type="number"
            min="0"
            max="24"
            step="0.25"
            inputMode="decimal"
            value={hours}
            onChange={(e) => setHours(e.target.value)}
            placeholder="0"
            className="w-full bg-panel2 border border-border rounded-lg px-3 py-2.5 text-accent2 font-semibold placeholder:text-muted/60 outline-none focus:border-accent transition"
          />
        </div>
      </div>

      <div className="flex items-center gap-2 mt-3 flex-wrap">
        <span className="text-muted text-xs">{t.sorterForm.quick}</span>
        {QUICK_HOURS.map((h) => (
          <button
            key={h}
            type="button"
            onClick={() => setHours(String(h))}
            className={`text-xs font-semibold rounded-lg px-3 py-1.5 border transition ${
              hoursNum === h
                ? "bg-accent text-bg border-accent"
                : "bg-panel2 text-muted border-border hover:text-white hover:border-accent/50"
            }`}
          >
            {h} {t.dashboard.hoursShort}
          </button>
        ))}
      </div>

      {error && (
        <div className="text-sm text-danger bg-danger/10 border border-danger/30 rounded-lg px-3 py-2 mt-3">{error}</div>
      )}

      <div className="flex items-center justify-between mt-5 flex-wrap gap-3">
        <span className="text-sm text-muted">
          {t.sorterForm.dayEarnings} <span className="text-white font-bold">{formatEuro(preview)}</span>{" "}
          <span className="text-muted/70">{t.sorterForm.rateNote(Number(rate).toFixed(2))}</span>
        </span>
        <div className="flex gap-2">
          {existing && (
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2 rounded-lg text-sm font-semibold text-muted hover:text-white border border-border transition"
            >
              {t.sorterForm.cancel}
            </button>
          )}
          <button
            type="submit"
            disabled={busy}
            className="px-5 py-2 rounded-lg text-sm font-bold bg-accent hover:bg-accent/90 disabled:opacity-60 text-bg transition"
          >
            {busy ? t.sorterForm.saving : existing ? t.sorterForm.save : t.sorterForm.add}
          </button>
        </div>
      </div>
    </form>
  );
}
