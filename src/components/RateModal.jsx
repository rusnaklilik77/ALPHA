import { useState } from "react";
import { useLanguage } from "../context/LanguageContext";

export default function RateModal({ currentRate, onSave, onClose }) {
  const { t } = useLanguage();
  const [rate, setRate] = useState(currentRate);
  const [busy, setBusy] = useState(false);

  async function handleSave(e) {
    e.preventDefault();
    setBusy(true);
    try {
      await onSave(Number(rate));
      onClose();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center px-4 z-50">
      <div className="bg-panel border border-border rounded-xl2 shadow-card p-6 w-full max-w-sm">
        <h3 className="text-white font-bold text-lg mb-1">{t.rateModal.title}</h3>
        <p className="text-muted text-sm mb-5">{t.rateModal.description}</p>
        <form onSubmit={handleSave}>
          <label className="block text-xs font-medium text-muted mb-1.5">{t.rateModal.label}</label>
          <input
            type="number"
            step="0.01"
            min="0"
            required
            value={rate}
            onChange={(e) => setRate(e.target.value)}
            className="w-full bg-panel2 border border-border rounded-lg px-3 py-2.5 text-white outline-none focus:border-accent transition mb-5"
          />
          <div className="flex gap-2 justify-end">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-sm font-semibold text-muted hover:text-white border border-border transition"
            >
              {t.rateModal.cancel}
            </button>
            <button
              type="submit"
              disabled={busy}
              className="px-5 py-2 rounded-lg text-sm font-bold bg-accent hover:bg-accent/90 disabled:opacity-60 text-bg transition"
            >
              {busy ? t.rateModal.saving : t.rateModal.save}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
