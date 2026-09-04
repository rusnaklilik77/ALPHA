import { useEffect, useState } from "react";
import { todayStr } from "../lib/utils";
import { useLanguage } from "../context/LanguageContext";

// Один день = одна запись. Логика по инструкции: с утра сотрудник вписывает
// только "Всего посылок" (сколько получил на руки), а вечером открывает эту
// же запись через "Изменить" и дописывает, сколько отдал / вернул / получил
// чаевых. Поля не связаны друг с другом — при повторном сохранении меняются
// только те значения, что реально стоят в форме на момент нажатия "Сохранить".
export default function EntryForm({ rate, role = "privat", onSubmit, existing, onCancel }) {
  const { t } = useLanguage();
  const [date, setDate] = useState(existing?.id || todayStr());
  const [totalParcels, setTotalParcels] = useState(existing?.totalParcels ?? "");
  const [delivered, setDelivered] = useState(existing?.delivered ?? "");
  const [returns, setReturns] = useState(existing?.returns ?? "");
  const [tips, setTips] = useState(existing?.tips ?? "");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (existing) {
      setDate(existing.id);
      setTotalParcels(existing.totalParcels ?? "");
      setDelivered(existing.delivered ?? "");
      setReturns(existing.returns ?? "");
      setTips(existing.tips ?? "");
    }
  }, [existing]);

  async function handleSubmit(e) {
    e.preventDefault();
    setBusy(true);
    try {
      await onSubmit({
        date,
        totalParcels: Number(totalParcels) || 0,
        delivered: Number(delivered) || 0,
        returns: Number(returns) || 0,
        tips: Number(tips) || 0,
      });
      if (!existing) {
        setTotalParcels("");
        setDelivered("");
        setReturns("");
        setTips("");
      }
    } finally {
      setBusy(false);
    }
  }

  const isShop = role === "shop";
  // Для роли "Шоп" ставки за посылку нет — заработок за день не считаем по
  // формуле "посылки × ставка", он получает фиксированную сумму за месяц
  // (см. кнопку "Доход за месяц" в шапке), поэтому превью показываем только
  // курьерам на приват.
  const preview = (Number(delivered) || 0) * Number(rate || 0) + (Number(tips) || 0);

  return (
    <form onSubmit={handleSubmit} className="bg-panel border border-border rounded-xl2 shadow-card p-5">
      <h3 className="text-white font-bold mb-1">
        {existing ? t.entryForm.editTitle : t.entryForm.addTitle}
      </h3>
      <p className="text-muted text-xs mb-4">{t.entryForm.morningEveningHint}</p>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        <div>
          <label className="block text-xs font-medium text-muted mb-1.5">{t.entryForm.date}</label>
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
          <label className="block text-xs font-medium text-muted mb-1.5">
            {t.entryForm.totalParcels}
          </label>
          <input
            type="number"
            min="0"
            inputMode="numeric"
            value={totalParcels}
            onChange={(e) => setTotalParcels(e.target.value)}
            placeholder="0"
            className="w-full bg-panel2 border border-border rounded-lg px-3 py-2.5 text-white placeholder:text-muted/60 outline-none focus:border-accent transition"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-muted mb-1.5">{t.entryForm.deliveredLabel(role)}</label>
          <input
            type="number"
            min="0"
            inputMode="numeric"
            value={delivered}
            onChange={(e) => setDelivered(e.target.value)}
            placeholder="0"
            className="w-full bg-panel2 border border-border rounded-lg px-3 py-2.5 text-accent2 placeholder:text-muted/60 outline-none focus:border-accent transition"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-muted mb-1.5">{t.entryForm.returnsLabel(role)}</label>
          <input
            type="number"
            min="0"
            inputMode="numeric"
            value={returns}
            onChange={(e) => setReturns(e.target.value)}
            placeholder="0"
            className="w-full bg-panel2 border border-border rounded-lg px-3 py-2.5 text-danger placeholder:text-muted/60 outline-none focus:border-accent transition"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-muted mb-1.5">{t.entryForm.tips}</label>
          <input
            type="number"
            min="0"
            step="0.01"
            inputMode="decimal"
            value={tips}
            onChange={(e) => setTips(e.target.value)}
            placeholder="0"
            className="w-full bg-panel2 border border-border rounded-lg px-3 py-2.5 text-accent placeholder:text-muted/60 outline-none focus:border-accent transition"
          />
        </div>
      </div>

      <div className="flex items-center justify-between mt-5 flex-wrap gap-3">
        {!isShop ? (
          <span className="text-sm text-muted">
            {t.entryForm.dayEarnings}{" "}
            <span className="text-white font-bold">
              {preview.toLocaleString("de-DE", { style: "currency", currency: "EUR" })}
            </span>{" "}
            <span className="text-muted/70">{t.entryForm.rateNote(Number(rate).toFixed(2))}</span>
          </span>
        ) : (
          <span className="text-sm text-muted">{t.entryForm.shopNote}</span>
        )}
        <div className="flex gap-2">
          {existing && (
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2 rounded-lg text-sm font-semibold text-muted hover:text-white border border-border transition"
            >
              {t.entryForm.cancel}
            </button>
          )}
          <button
            type="submit"
            disabled={busy}
            className="px-5 py-2 rounded-lg text-sm font-bold bg-accent hover:bg-accent/90 disabled:opacity-60 text-bg transition"
          >
            {busy ? t.entryForm.saving : existing ? t.entryForm.save : t.entryForm.add}
          </button>
        </div>
      </div>
    </form>
  );
}
