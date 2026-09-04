import { useEffect, useMemo, useState } from "react";
import { useLanguage } from "../context/LanguageContext";
import { subscribeMonthStatsAllUsers } from "../lib/data";
import { formatMonthLabel, monthsSinceStart, currentMonthKey } from "../lib/utils";

// Общий рейтинг сотрудников по количеству отданных посылок за месяц —
// отдельно для "Приват" и "Шоп", чтобы они не смешивались друг с другом (у
// них разная модель оплаты и разная нагрузка). Первое место получает корону
// у имени, последнее (если участников больше одного) — красную надпись
// "ЛУЗЕР". Список сотрудников приходит "живым" через subscribeAllUsersAdmin
// в AdminPanel, поэтому новый зарегистрированный человек сам появляется в
// своей группе рейтинга — ничего вручную добавлять не нужно.
export default function Leaderboard({ employees, currentUid }) {
  const { t, lang } = useLanguage();
  const [group, setGroup] = useState("privat"); // privat | shop
  const [month, setMonth] = useState(currentMonthKey());
  const [statsByUid, setStatsByUid] = useState(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Только месяцы, в которых компания реально работала (с августа 2026) и
  // не позже текущего месяца. Список пересчитывается при каждом рендере от
  // сегодняшней даты, поэтому 1-го числа нового месяца вкладка появляется
  // сама, а апрель/май/июнь/июль 2026 никогда не показываются.
  const months = useMemo(() => monthsSinceStart(), []);

  useEffect(() => {
    setLoading(true);
    setError(null);
    const unsub = subscribeMonthStatsAllUsers(
      month,
      (map) => {
        setStatsByUid(map);
        setLoading(false);
      },
      (err) => {
        setError(err);
        setLoading(false);
      }
    );
    return unsub;
  }, [month]);

  const rows = useMemo(() => {
    const filtered = employees.filter((e) => (e.role === "shop" ? "shop" : "privat") === group);
    const withStats = filtered.map((e) => {
      const s = statsByUid.get(e.uid) || { delivered: 0, returns: 0, tips: 0 };
      return { ...e, delivered: s.delivered, returns: s.returns, tips: s.tips };
    });
    withStats.sort((a, b) => b.delivered - a.delivered);
    return withStats;
  }, [employees, statsByUid, group]);

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-white font-bold text-lg mb-1">{t.rating.title}</h2>
        <p className="text-muted text-sm">{t.rating.description}</p>
      </div>

      {/* Переключатель Приват / Шоп — раздельные рейтинги, не смешиваются */}
      <div className="flex bg-panel2 rounded-lg p-1 max-w-xs">
        <button
          type="button"
          onClick={() => setGroup("privat")}
          className={`flex-1 py-2 rounded-md text-sm font-semibold transition ${
            group === "privat" ? "bg-accent text-bg" : "text-muted hover:text-white"
          }`}
        >
          {t.rating.tabPrivat}
        </button>
        <button
          type="button"
          onClick={() => setGroup("shop")}
          className={`flex-1 py-2 rounded-md text-sm font-semibold transition ${
            group === "shop" ? "bg-accent text-bg" : "text-muted hover:text-white"
          }`}
        >
          {t.rating.tabShop}
        </button>
      </div>

      {/* Вкладки месяцев — рейтинг сохраняется помесячно, можно посмотреть,
          кто и сколько отдал в любом из прошлых месяцев */}
      <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-none">
        {months.map((key) => (
          <button
            key={key}
            onClick={() => setMonth(key)}
            className={`shrink-0 whitespace-nowrap rounded-lg px-4 py-2 text-sm font-semibold border transition ${
              key === month
                ? "bg-accent text-bg border-accent"
                : "bg-panel text-muted border-border hover:text-white hover:border-accent/50"
            }`}
          >
            {formatMonthLabel(key, lang)}
          </button>
        ))}
      </div>

      {error ? (
        <div className="bg-danger/10 border border-danger/40 rounded-xl2 p-5 text-sm text-danger space-y-2">
          <div className="font-semibold">{t.rating.loadError}</div>
          <div className="text-danger/80 text-xs leading-relaxed">{t.rating.loadErrorHint}</div>
          {error.message && (
            <div className="text-danger/60 text-[11px] font-mono break-all pt-1">{error.message}</div>
          )}
        </div>
      ) : loading ? (
        <div className="bg-panel border border-border rounded-xl2 p-8 text-center text-muted">
          {t.admin.loading}
        </div>
      ) : rows.length === 0 ? (
        <div className="bg-panel border border-border rounded-xl2 p-8 text-center text-muted">
          {t.rating.empty}
        </div>
      ) : (
        <div className="bg-panel border border-border rounded-xl2 shadow-card overflow-hidden divide-y divide-border">
          {rows.map((r, i) => {
            const isFirst = i === 0 && r.delivered > 0;
            const isLast = i === rows.length - 1 && rows.length > 1 && r.delivered < rows[0].delivered;
            return (
              <div
                key={r.uid}
                className={`flex items-center justify-between gap-3 px-5 py-3.5 flex-wrap ${
                  isFirst ? "bg-accent/5" : ""
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span
                    className={`w-7 h-7 shrink-0 rounded-full flex items-center justify-center text-xs font-bold ${
                      isFirst
                        ? "bg-yellow-400/20 text-yellow-300 border border-yellow-400/40"
                        : "bg-panel2 text-muted border border-border"
                    }`}
                  >
                    {i + 1}
                  </span>
                  <div className="min-w-0">
                    <div className="text-white font-semibold truncate flex items-center gap-1.5">
                      {isFirst && <span title={t.rating.firstPlaceTitle}>👑</span>}
                      <span className="truncate">{r.name || t.admin.unnamed}</span>
                      {r.uid === currentUid && (
                        <span className="text-[10px] uppercase tracking-wide text-accent shrink-0">you</span>
                      )}
                      {isLast && (
                        <span className="text-[10px] font-bold uppercase tracking-wide text-danger border border-danger/40 bg-danger/10 rounded-full px-2 py-0.5 shrink-0">
                          {t.rating.loserLabel}
                        </span>
                      )}
                    </div>
                    <div className="text-muted text-xs">
                      {t.admin.idLabel}: {r.employeeId || "—"}
                    </div>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-accent2 font-bold text-lg">{r.delivered}</div>
                  <div className="text-muted text-xs">{t.rating.deliveredColumn}</div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
