import { useEffect, useMemo, useState } from "react";
import { useLanguage } from "../context/LanguageContext";
import {
  subscribeAllUsersAdmin,
  subscribeEntriesAdmin,
  subscribeMonthlyPay,
  adminLogout,
  DEFAULT_RATE,
  DEFAULT_ROLE,
} from "../lib/data";
import {
  totals,
  formatEuro,
  formatMonthLabel,
  listMonths,
  entriesForMonth,
  currentMonthKey,
  monthlyBreakdown,
} from "../lib/utils";
import StatCard from "../components/StatCard";
import EntryList from "../components/EntryList";
import MonthTabs from "../components/MonthTabs";
import Leaderboard from "../components/Leaderboard";
import { TrendChart, DonutChart } from "../components/Charts";

// Режим администратора: список всех зарегистрированных сотрудников (по
// документам users/*) с поиском по имени/ID, и статистика выбранного
// сотрудника (доставлено/возвращено/заработано), собранная из его записей
// users/{uid}/entries/*. Данные читаются через отдельную admin-сессию (см.
// adminAuth/adminDb в src/firebase.js) — доступность целиком регулируется
// правилами Firestore (см. firestore.rules), этот компонент просто
// отображает то, что сервер согласился отдать.
export default function AdminPanel({ currentUid, onClose }) {
  const { t, lang } = useLanguage();
  const [view, setView] = useState("employees"); // employees | rating
  const [employees, setEmployees] = useState([]);
  const [loadingList, setLoadingList] = useState(true);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(null);
  const [entries, setEntries] = useState([]);
  const [selectedMonthlyPay, setSelectedMonthlyPay] = useState({});
  const [loadingEntries, setLoadingEntries] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(currentMonthKey());

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
    setSelectedMonth(currentMonthKey());
    const unsub = subscribeEntriesAdmin(selected.uid, (data) => {
      setEntries(data);
      setLoadingEntries(false);
    });
    const unsubPay = subscribeMonthlyPay(selected.uid, setSelectedMonthlyPay);
    return () => {
      unsub();
      unsubPay();
    };
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
  const selectedRole = selected ? (selected.role === "shop" ? "shop" : DEFAULT_ROLE) : DEFAULT_ROLE;

  // Список месяцев, за которые у сотрудника есть записи (плюс текущий) — та же
  // логика, что и в обычном дашборде, теперь доступна и админу: можно
  // переключаться по вкладкам (август, сентябрь и т.д.) и видеть данные
  // именно за выбранный месяц, а не только суммарно за всё время.
  const months = useMemo(() => listMonths(entries), [entries]);
  useEffect(() => {
    if (!months.includes(selectedMonth)) {
      setSelectedMonth(currentMonthKey());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [months]);
  const monthEntries = useMemo(() => entriesForMonth(entries, selectedMonth), [entries, selectedMonth]);
  const monthLabel = formatMonthLabel(selectedMonth, lang);
  const monthStatsRaw = useMemo(() => totals(monthEntries, selectedRate), [monthEntries, selectedRate]);
  const allTimeStatsRaw = useMemo(() => totals(entries, selectedRate), [entries, selectedRate]);
  const breakdownRaw = useMemo(() => monthlyBreakdown(entries, selectedRate), [entries, selectedRate]);

  // Как и на дашборде сотрудника: для роли "Шоп" заработок — это сумма,
  // введённая самим сотрудником за месяц, а не посылки × ставка.
  const isSelectedShop = selectedRole === "shop";
  const selectedMonthlyPayAmount = Number(selectedMonthlyPay[selectedMonth]) || 0;
  const totalSelectedMonthlyPay = useMemo(
    () => Object.values(selectedMonthlyPay).reduce((sum, v) => sum + (Number(v) || 0), 0),
    [selectedMonthlyPay]
  );
  const monthStats = isSelectedShop
    ? { ...monthStatsRaw, earnings: selectedMonthlyPayAmount + monthStatsRaw.tips }
    : monthStatsRaw;
  const allTimeStats = isSelectedShop
    ? { ...allTimeStatsRaw, earnings: totalSelectedMonthlyPay + allTimeStatsRaw.tips }
    : allTimeStatsRaw;
  const breakdown = isSelectedShop
    ? breakdownRaw.map((m) => ({ ...m, earnings: (Number(selectedMonthlyPay[m.key]) || 0) + m.tips }))
    : breakdownRaw;

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
        {!selected && (
          <div className="flex bg-panel2 rounded-lg p-1 max-w-xs">
            <button
              type="button"
              onClick={() => setView("employees")}
              className={`flex-1 py-2 rounded-md text-sm font-semibold transition ${
                view === "employees" ? "bg-accent text-bg" : "text-muted hover:text-white"
              }`}
            >
              {t.admin.tabEmployees}
            </button>
            <button
              type="button"
              onClick={() => setView("rating")}
              className={`flex-1 py-2 rounded-md text-sm font-semibold transition ${
                view === "rating" ? "bg-accent text-bg" : "text-muted hover:text-white"
              }`}
            >
              {t.admin.tabRating}
            </button>
          </div>
        )}

        {!selected && view === "rating" ? (
          <Leaderboard employees={employees} currentUid={currentUid} />
        ) : !selected ? (
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
                <div className="text-white font-bold text-lg flex items-center gap-2 flex-wrap">
                  {selected.name || t.admin.unnamed}
                  <span className="text-[10px] font-semibold uppercase tracking-wide bg-accent/15 border border-accent/30 text-accent rounded-full px-2 py-0.5">
                    {t.admin.roleLabel(selectedRole)}
                  </span>
                </div>
                <div className="text-muted text-sm">
                  {t.admin.idLabel}: {selected.employeeId || "—"}
                </div>
              </div>
              <div className="text-right">
                {isSelectedShop ? (
                  <>
                    <div className="text-muted text-xs uppercase tracking-wide">
                      {t.admin.monthlyPayLabel(monthLabel)}
                    </div>
                    <div className="text-accent font-bold text-lg">{formatEuro(selectedMonthlyPayAmount)}</div>
                  </>
                ) : (
                  <>
                    <div className="text-muted text-xs uppercase tracking-wide">{t.admin.rate}</div>
                    <div className="text-accent font-bold text-lg">
                      {Number(selected.rate ?? DEFAULT_RATE).toFixed(2)} €
                    </div>
                  </>
                )}
              </div>
            </div>

            {loadingEntries ? (
              <div className="bg-panel border border-border rounded-xl2 p-8 text-center text-muted">
                {t.admin.loading}
              </div>
            ) : (
              <>
                {/* Общий итог за всё время — не зависит от выбранной вкладки месяца ниже */}
                <div>
                  <h2 className="text-white font-bold text-lg mb-3">{t.admin.allTime}</h2>
                  <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
                    <StatCard
                      label={t.admin.earnings}
                      value={formatEuro(allTimeStats.earnings)}
                      valueColor="text-white"
                      icon="💶"
                    />
                    <StatCard
                      label={t.admin.delivered}
                      value={allTimeStats.delivered}
                      valueColor="text-accent2"
                      icon="📦"
                    />
                    <StatCard
                      label={t.admin.returns}
                      value={allTimeStats.returns}
                      valueColor="text-danger"
                      icon="↩️"
                    />
                    <StatCard
                      label={t.admin.tips}
                      value={formatEuro(allTimeStats.tips)}
                      valueColor="text-accent"
                      icon="🎁"
                    />
                    <StatCard
                      label={t.admin.workDays}
                      value={allTimeStats.days}
                      valueColor="text-white"
                      icon="📅"
                    />
                  </div>
                </div>

                {/* Разбивка по месяцам — теперь доступна и админу, точно так же,
                    как окно "Общий баланс" у самого сотрудника: август, сентябрь
                    и так далее видны отдельными строками и никуда не пропадают. */}
                <div>
                  <div className="text-xs uppercase tracking-wide text-muted font-medium mb-2">
                    {t.admin.monthlyTitle}
                  </div>
                  <div className="bg-panel border border-border rounded-xl2 shadow-card overflow-hidden divide-y divide-border">
                    {breakdown.length === 0 ? (
                      <div className="text-muted text-sm text-center py-6">{t.balanceModal.empty}</div>
                    ) : (
                      breakdown.map((m) => (
                        <div
                          key={m.key}
                          className="flex items-center justify-between gap-3 px-5 py-3.5 flex-wrap"
                        >
                          <div>
                            <div className="text-white font-semibold text-sm">
                              {formatMonthLabel(m.key, lang)}
                            </div>
                            <div className="text-muted text-xs mt-0.5">
                              📦 <span className="text-accent2 font-semibold">{m.delivered}</span> · 🎁{" "}
                              <span className="text-accent font-semibold">{formatEuro(m.tips)}</span> · ↩️{" "}
                              <span className="text-danger font-semibold">{m.returns}</span> · 📅{" "}
                              <span className="text-white font-semibold">{m.days}</span>
                            </div>
                          </div>
                          <div className="text-white font-bold text-base shrink-0">{formatEuro(m.earnings)}</div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                <MonthTabs months={months} selected={selectedMonth} onSelect={setSelectedMonth} />

                <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
                  <StatCard
                    label={t.admin.earnings}
                    value={formatEuro(monthStats.earnings)}
                    valueColor="text-white"
                    icon="💶"
                  />
                  <StatCard
                    label={t.admin.delivered}
                    value={monthStats.delivered}
                    valueColor="text-accent2"
                    icon="📦"
                  />
                  <StatCard
                    label={t.admin.returns}
                    value={monthStats.returns}
                    valueColor="text-danger"
                    icon="↩️"
                  />
                  <StatCard
                    label={t.admin.tips}
                    value={formatEuro(monthStats.tips)}
                    valueColor="text-accent"
                    icon="🎁"
                  />
                  <StatCard
                    label={t.admin.workDays}
                    value={monthStats.days}
                    valueColor="text-white"
                    icon="📅"
                  />
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <div className="bg-panel border border-border rounded-xl2 shadow-card p-5">
                    <h4 className="text-white font-semibold text-sm mb-2">
                      {t.dashboard.charts.deliveredTrend}
                    </h4>
                    <TrendChart entries={monthEntries} />
                  </div>
                  <div className="bg-panel border border-border rounded-xl2 shadow-card p-5 flex flex-col items-center">
                    <h4 className="text-white font-semibold text-sm mb-2 self-start">
                      {t.dashboard.charts.donutTitle(monthLabel)}
                    </h4>
                    <DonutChart delivered={monthStats.delivered} returns={monthStats.returns} />
                  </div>
                </div>

                <div>
                  <h2 className="text-white font-bold text-lg mb-3">
                    {t.admin.historyTitle} — {monthLabel}
                  </h2>
                  <EntryList
                    entries={monthEntries}
                    rate={selectedRate}
                    role={selectedRole}
                    readOnly
                    emptyMessage={t.admin.noEntries}
                  />
                </div>
              </>
            )}
          </>
        )}
      </main>
    </div>
  );
}
