import { formatEuro, formatMonthLabel } from "../lib/utils";
import { useLanguage } from "../context/LanguageContext";

// Всплывающее окно "Общий баланс" — сводка заработка по всем месяцам сразу,
// плюс общий итог за всё время наверху.
export default function BalanceModal({ breakdown, grandTotal, onClose }) {
  const { t, lang } = useLanguage();

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center px-4 z-50">
      <div className="bg-panel border border-border rounded-xl2 shadow-card p-6 w-full max-w-lg max-h-[85vh] flex flex-col">
        <div className="flex items-start justify-between gap-3 mb-1">
          <h3 className="text-white font-bold text-lg">{t.balanceModal.title}</h3>
          <button
            onClick={onClose}
            className="text-muted hover:text-white shrink-0 w-8 h-8 flex items-center justify-center rounded-lg hover:bg-panel2 transition"
            aria-label={t.balanceModal.close}
          >
            ✕
          </button>
        </div>
        <p className="text-muted text-sm mb-4">{t.balanceModal.description}</p>

        <div className="bg-gradient-to-br from-panel2 to-panel border border-accent/30 rounded-xl2 p-5 mb-4 shrink-0">
          <span className="text-muted text-xs font-medium uppercase tracking-wide">
            {t.balanceModal.grandTotal}
          </span>
          <div className="text-3xl sm:text-4xl font-black text-white tracking-tight mt-1">
            {formatEuro(grandTotal.earnings)}
          </div>
          <div className="flex flex-wrap gap-x-5 gap-y-1 mt-3 text-sm text-muted">
            <span>
              📦 <span className="text-accent2 font-semibold">{grandTotal.delivered}</span>{" "}
              {t.dashboard.delivered}
            </span>
            <span>
              🎁 <span className="text-accent font-semibold">{formatEuro(grandTotal.tips)}</span>{" "}
              {t.balanceModal.tips}
            </span>
            <span>
              📅 <span className="text-white font-semibold">{grandTotal.days}</span>{" "}
              {t.dashboard.workDays}
            </span>
          </div>
        </div>

        <div className="text-xs uppercase tracking-wide text-muted font-medium mb-2">
          {t.balanceModal.byMonth}
        </div>
        <div className="overflow-y-auto -mx-1 px-1 space-y-2">
          {breakdown.length === 0 && (
            <div className="text-muted text-sm text-center py-6">{t.balanceModal.empty}</div>
          )}
          {breakdown.map((m) => (
            <div
              key={m.key}
              className="flex items-center justify-between gap-3 bg-panel2 border border-border rounded-lg px-4 py-3"
            >
              <div>
                <div className="text-white font-semibold text-sm">{formatMonthLabel(m.key, lang)}</div>
                <div className="text-muted text-xs mt-0.5">
                  📦 {m.delivered} · 🎁 {formatEuro(m.tips)} · 📅 {m.days}
                </div>
              </div>
              <div className="text-white font-bold text-sm sm:text-base shrink-0">
                {formatEuro(m.earnings)}
              </div>
            </div>
          ))}
        </div>

        <button
          onClick={onClose}
          className="mt-5 w-full px-4 py-2.5 rounded-lg text-sm font-bold bg-accent hover:bg-accent/90 text-bg transition shrink-0"
        >
          {t.balanceModal.close}
        </button>
      </div>
    </div>
  );
}
