import { useMemo, useState } from "react";
import { useLanguage } from "../context/LanguageContext";
import { todayStr, formatDateHuman, formatMonthLabel, buildMonthGrid } from "../lib/utils";

// Панель водителя: каждый день нажимает большую зелёную галочку — «отработал».
// Ниже — календарь выбранного месяца: отработанные дни подсвечены зелёным,
// по нажатию на день его можно отметить или снять отметку (если забыл
// отметиться вчера). Будущие дни отметить нельзя.
export default function DriverDayPanel({ entries, rate, selectedMonth, onSetWorked, onUnsetWorked }) {
  const { t, lang, weekdaysMonFirst } = useLanguage();
  const [busyDate, setBusyDate] = useState("");
  const [error, setError] = useState("");

  const today = todayStr();
  const workedSet = useMemo(() => new Set(entries.filter((e) => e.worked === true).map((e) => e.id)), [entries]);
  const todayWorked = workedSet.has(today);
  const weeks = useMemo(() => buildMonthGrid(selectedMonth), [selectedMonth]);

  async function toggle(dateStr) {
    if (busyDate || dateStr > today) return;
    setError("");
    const isWorked = workedSet.has(dateStr);
    if (isWorked && dateStr !== today) {
      if (!confirm(t.driverPanel.confirmUnmark(formatDateHuman(dateStr, lang)))) return;
    }
    setBusyDate(dateStr);
    try {
      if (isWorked) await onUnsetWorked(dateStr);
      else await onSetWorked(dateStr);
    } catch (err) {
      console.error("[ALPHA] driver toggle:", err);
      setError(t.driverPanel.saveError);
    } finally {
      setBusyDate("");
    }
  }

  return (
    <div className="bg-panel border border-border rounded-xl2 shadow-card p-5">
      <h3 className="text-white font-bold mb-1">{t.driverPanel.title}</h3>
      <p className="text-muted text-xs mb-4">{t.driverPanel.todayLabel(formatDateHuman(today, lang))}</p>

      {todayWorked ? (
        <div className="flex items-center justify-between gap-4 flex-wrap bg-accent2/10 border border-accent2/40 rounded-xl2 p-4">
          <div className="flex items-center gap-3">
            <div className="w-14 h-14 rounded-full bg-accent2 text-bg flex items-center justify-center text-3xl font-black shrink-0">
              ✓
            </div>
            <div>
              <div className="text-white font-bold">{t.driverPanel.markedWorked}</div>
              <div className="text-accent2 text-sm font-semibold">{t.driverPanel.earnedToday(rate)}</div>
            </div>
          </div>
          <button
            type="button"
            onClick={() => toggle(today)}
            disabled={!!busyDate}
            className="text-xs font-semibold text-muted hover:text-danger border border-border hover:border-danger rounded-lg px-3 py-1.5 transition disabled:opacity-60"
          >
            {t.driverPanel.undo}
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => toggle(today)}
          disabled={!!busyDate}
          className="w-full flex items-center justify-center gap-3 rounded-xl2 bg-accent2 hover:bg-accent2/90 active:scale-[0.99] disabled:opacity-60 text-bg py-5 transition shadow-[0_6px_24px_rgba(34,197,94,0.3)]"
        >
          <span className="w-12 h-12 rounded-full bg-bg/20 flex items-center justify-center text-3xl font-black">✓</span>
          <span className="text-lg font-black">{t.driverPanel.markWorked}</span>
        </button>
      )}

      {error && (
        <div className="text-sm text-danger bg-danger/10 border border-danger/30 rounded-lg px-3 py-2 mt-3">{error}</div>
      )}

      {/* Календарь месяца */}
      <div className="mt-5">
        <div className="text-xs uppercase tracking-wide text-muted font-medium mb-2">
          {t.driverPanel.calendarTitle(formatMonthLabel(selectedMonth, lang))}
        </div>
        <div className="grid grid-cols-7 gap-1.5 mb-1.5">
          {weekdaysMonFirst.map((d) => (
            <div key={d} className="text-center text-[10px] uppercase tracking-wide text-muted/70">
              {d}
            </div>
          ))}
        </div>
        <div className="space-y-1.5">
          {weeks.map((week, wi) => (
            <div key={wi} className="grid grid-cols-7 gap-1.5">
              {week.map((dateStr, di) => {
                if (!dateStr) return <div key={di} />;
                const isWorked = workedSet.has(dateStr);
                const isFuture = dateStr > today;
                const isToday = dateStr === today;
                return (
                  <button
                    key={di}
                    type="button"
                    disabled={isFuture || !!busyDate}
                    onClick={() => toggle(dateStr)}
                    className={`relative aspect-square rounded-lg text-sm font-semibold border transition flex items-center justify-center ${
                      isWorked
                        ? "bg-accent2 text-bg border-accent2"
                        : isFuture
                          ? "bg-panel2/40 text-muted/40 border-border/40 cursor-not-allowed"
                          : "bg-panel2 text-white border-border hover:border-accent2/60"
                    } ${isToday ? "ring-2 ring-accent ring-offset-1 ring-offset-panel" : ""} ${
                      busyDate === dateStr ? "opacity-50" : ""
                    }`}
                    aria-pressed={isWorked}
                    aria-label={dateStr}
                  >
                    {isWorked ? "✓" : Number(dateStr.slice(8, 10))}
                    {isWorked && (
                      <span className="absolute top-0.5 right-1 text-[9px] font-bold opacity-70">
                        {Number(dateStr.slice(8, 10))}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
        <p className="text-muted/70 text-[11px] mt-2">{t.driverPanel.calendarHint}</p>
      </div>
    </div>
  );
}
