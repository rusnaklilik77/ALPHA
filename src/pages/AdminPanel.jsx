import { useEffect, useMemo, useState } from "react";
import { useLanguage } from "../context/LanguageContext";
import { subscribeAllUsersAdmin, subscribeEntriesAdmin, adminLogout, DEFAULT_RATE } from "../lib/data";
import { totals, formatEuro } from "../lib/utils";
import StatCard from "../components/StatCard";
import EntryList from "../components/EntryList";
import { TrendChart } from "../components/Charts";

// Режим администратора: список всех зарегистрированных сотрудников (по
// документам users/*) с поиском по имени/ID, и статистика выбранного
// сотрудника (доставлено/возвращено/заработано), собранная из его записей
// users/{uid}/entries/*. Данные читаются через отдельную admin-сессию (см.
// adminAuth/adminDb в src/firebase.js) — доступность целиком регулируется
// правилами Firestore (см. firestore.rules), этот компонент просто
// отображает то, что сервер согласился отдать.
export default function AdminPanel({ currentUid, onClose }) {
  const { t } = useLanguage();
  const [employees, setEmployees] = useState([]);
  const [loadingList, setLoadingList] = useState(true);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(null);
  const [entries, setEntries] = useState([]);
  const [loadingEntries, setLoadingEntries] = useState(false);

  useEffect(() => {
    const unsub = subscribeAllUsersAdmin((list) => {
      setEmployees(list);
      setLoadingList(false);
    });
    return unsub;
  }, []);

  useEffect(() => {
    if (!selected) {
      setEntries([]);
      return;
    }
    setLoadingEntries(true);
    const unsub = subscribeEntriesAdmin(selected.uid, (data) => {
      setEntries(data);
      setLoadingEntries(false);
    });
    return unsub;
  }, [selected]);

  function handleClose() {
    // Закрываем изолированную admin-сессию — учётные данные администратора
    // не остаются залогиненными в фоне после выхода из панели.
    adminLogout();
    onClose();
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return employees;
    return employees.filter((e) => {
      const name = (e.name || "").toLowerCase();
      const id = String(e.employeeId || "").toLowerCase();
      return name.includes(q) || id.includes(q);
    });
  }, [employees, query]);

  const selectedRate = selected ? Number(selected.rate ?? DEFAULT_RATE) : DEFAULT_RATE;
  const stats = useMemo(() => totals(entries, selectedRate), [entries, selectedRate]);

  return (
    <div className="min-h-screen bg-bg pb-16">
      <header className="sticky top-0 z-30 bg-bg/90 backdrop-blur border-b border-border">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="text-white font-bold leading-tight truncate">{t.admin.title}</div>
            <div className="text-muted text-xs truncate">{t.admin.subtitle}</div>
          </div>
          <button
            onClick={handleClose}
            className="text-xs sm:text-sm font-semibold text-muted hover:text-white border border-border hover:border-accent rounded-lg px-3 py-2 transition shrink-0"
          >
            {t.admin.back}
          </button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 pt-6 space-y-6">
        {!selected ? (
          <>
            <div className="relative">
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t.admin.searchPlaceholder}
                className="w-full bg-panel border border-border rounded-xl2 px-4 py-3 text-white placeholder:text-muted/60 outline-none focus:border-accent transition"
              />
            </div>

            {loadingList ? (
              <div className="bg-panel border border-border rounded-xl2 p-8 text-center text-muted">
                {t.admin.loading}
              </div>
            ) : filtered.length === 0 ? (
              <div className="bg-panel border border-border rounded-xl2 p-8 text-center text-muted">
                {employees.length === 0 ? t.admin.noEmployees : t.admin.noResults}
              </div>
            ) : (
              <div className="bg-panel border border-border rounded-xl2 shadow-card overflow-hidden divide-y divide-border">
                {filtered.map((emp) => (
                  <button
                    key={emp.uid}
                    onClick={() => setSelected(emp)}
                    className="w-full text-left px-5 py-4 flex items-center justify-between gap-3 hover:bg-panel2/60 transition"
                  >
                    <div className="min-w-0">
                      <div className="text-white font-semibold truncate">
                        {emp.name || t.admin.unnamed}
                        {emp.uid === currentUid && (
                          <span className="ml-2 text-[10px] uppercase tracking-wide text-accent">
                            you
                          </span>
                        )}
                      </div>
                      <div className="text-muted text-xs">
                        {t.admin.idLabel}: {emp.employeeId || "—"}
                      </div>
                    </div>
                    <span className="text-muted text-lg shrink-0">→</span>
                  </button>
                ))}
              </div>
            )}
          </>
        ) : (
          <>
            <button
              onClick={() => setSelected(null)}
              className="text-sm font-semibold text-accent hover:text-accent/80 transition"
            >
              {t.admin.backToList}
            </button>

            <div className="bg-panel border border-border rounded-xl2 shadow-card p-6 flex items-center justify-between gap-3 flex-wrap">
              <div>
                <div className="text-white font-bold text-lg">
                  {selected.name || t.admin.unnamed}
                </div>
                <div className="text-muted text-sm">
                  {t.admin.idLabel}: {selected.employeeId || "—"}
                </div>
              </div>
              <div className="text-right">
                <div className="text-muted text-xs uppercase tracking-wide">{t.admin.rate}</div>
                <div className="text-accent font-bold text-lg">
                  {Number(selected.rate ?? DEFAULT_RATE).toFixed(2)} €
                </div>
              </div>
            </div>

            {loadingEntries ? (
              <div className="bg-panel border border-border rounded-xl2 p-8 text-center text-muted">
                {t.admin.loading}
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
                  <StatCard
                    label={t.admin.earnings}
                    value={formatEuro(stats.earnings)}
                    valueColor="text-white"
                    icon="💶"
                  />
                  <StatCard
                    label={t.admin.delivered}
                    value={stats.delivered}
                    valueColor="text-accent2"
                    icon="📦"
                  />
                  <StatCard
                    label={t.admin.returns}
                    value={stats.returns}
                    valueColor="text-danger"
                    icon="↩️"
                  />
                  <StatCard
                    label={t.admin.tips}
                    value={formatEuro(stats.tips)}
                    valueColor="text-accent"
                    icon="🎁"
                  />
                  <StatCard
                    label={t.admin.workDays}
                    value={stats.days}
                    valueColor="text-white"
                    icon="📅"
                  />
                </div>

                <div className="bg-panel border border-border rounded-xl2 shadow-card p-5">
                  <h4 className="text-white font-semibold text-sm mb-2">
                    {t.dashboard.charts.deliveredTrend}
                  </h4>
                  <TrendChart entries={entries} />
                </div>

                <div>
                  <h2 className="text-white font-bold text-lg mb-3">{t.admin.historyTitle}</h2>
                  <EntryList entries={entries} rate={selectedRate} readOnly emptyMessage={t.admin.noEntries} />
                </div>
              </>
            )}
          </>
        )}
      </main>
    </div>
  );
}
