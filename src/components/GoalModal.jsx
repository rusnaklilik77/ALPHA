import { useState } from "react";
import { useLanguage } from "../context/LanguageContext";

// Небольшое окно для задания месячной цели по заработку (используется полоской
// прогресса на дашборде). 0 = цель выключена.
export default function GoalModal({ currentGoal, onSave, onClose }) {
  const { t } = useLanguage();
  const [goal, setGoal] = useState(currentGoal || "");
  const [busy, setBusy] = useState(false);

  async function handleSave(e) {
    e.preventDefault();
    setBusy(true);
    try {
      await onSave(Number(goal) || 0);
      onClose();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center px-4 z-50">
      <div className="bg-panel border border-border rounded-xl2 shadow-card p-6 w-full max-w-sm">
        <h3 className="text-white font-bold text-lg mb-1">{t.goalModal.title}</h3>
        <p className="text-muted text-sm mb-5">{t.goalModal.description}</p>
        <form onSubmit={handleSave}>
          <label className="block text-xs font-medium text-muted mb-1.5">{t.goalModal.label}</label>
          <input
            type="number"
            step="1"
            min="0"
            value={goal}
            onChange={(e) => setGoal(e.target.value)}
            placeholder="0"
            className="w-full bg-panel2 border border-border rounded-lg px-3 py-2.5 text-white outline-none focus:border-accent transition mb-5"
          />
          <div className="flex gap-2 justify-end">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-sm font-semibold text-muted hover:text-white border border-border transition"
            >
              {t.goalModal.cancel}
            </button>
            <button
              type="submit"
              disabled={busy}
              className="px-5 py-2 rounded-lg text-sm font-bold bg-accent hover:bg-accent/90 disabled:opacity-60 text-bg transition"
            >
              {busy ? t.goalModal.saving : t.goalModal.save}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
