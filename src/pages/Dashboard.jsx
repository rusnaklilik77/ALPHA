import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { useLanguage } from "../context/LanguageContext";
import {
  ensureUserDoc,
  subscribeUserSettings,
  subscribeEntries,
  upsertEntry,
  deleteEntry as removeEntry,
  setUserRate,
  setUserGoal,
  DEFAULT_RATE,
  adminLogin,
} from "../lib/data";
import {
  totals,
  formatEuro,
  formatDateHuman,
  formatDateShort,
  formatMonthLabel,
  listMonths,
  entriesForMonth,
  aggregateByWeekday,
  currentMonthKey,
  monthlyBreakdown,
  bestDay,
  exportEntriesToCSV,
} from "../lib/utils";
import Header from "../components/Header";
import StatCard from "../components/StatCard";
import EntryForm from "../components/EntryForm";
import EntryList from "../components/EntryList";
import RateModal from "../components/RateModal";
import GoalModal from "../components/GoalModal";
import BalanceModal from "../components/BalanceModal";
import AdminLoginModal from "../components/AdminLoginModal";
import MonthTabs from "../components/MonthTabs";
import { TrendChart, WeekdayBarChart } from "../components/Charts";
import AdminPanel from "./AdminPanel";

export default function Dashboard() {
  const { user, logout } = useAuth();
  const { t, lang } = useLanguage();
  const [rate, setRate] = useState(DEFAULT_RATE);
  const [goal, setGoal] = useState(0);
  const [employeeId, setEmployeeId] = useState("");
  const [adminOpen, setAdminOpen] = useState(false);
  const [adminLoginOpen, setAdminLoginOpen] = useState(false);
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);
  const [rateModalOpen, setRateModalOpen] = useState(false);
  const [goalModalOpen, setGoalModalOpen] = useState(false);
  const [balanceModalOpen, setBalanceModalOpen] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(currentMonthKey());

  useEffect(() => {
    if (!user) return;
    ensureUserDoc(user.uid);
    const unsubSettings = subscribeUserSettings(user.uid, (data) => {
      setRate(data.rate ?? DEFAULT_RATE);
      setGoal(data.goal ?? 0);
      setEmployeeId(data.employeeId ?? "");
    });
    const unsubEntries = subscribeEntries(user.uid, (data) => {
      setEntries(data);
      setLoading(false);
    });
    return () => {
      unsubSettings();
      unsubEntries();
    };
  }, [user]);

  // Список месяцев (включая уже завершившиеся, например август) — данные по ним
  // никуда не пропадают, т.к. каждая запись хранится по своей дате и просто
  // группируется во вкладку соответствующего месяца.
  const months = useMemo(() => listMonths(entries), [entries]);

  // Если выбранный месяц вдруг пропал (маловероятно) — откатываемся на текущий
  useEffect(() => {
    if (!months.includes(selectedMonth)) {
      setSelectedMonth(currentMonthKey());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [months]);

  const monthEntries = useMemo(() => entriesForMonth(entries, selectedMonth), [entries, selectedMonth]);
  const monthTotals = useMemo(() => totals(monthEntries), [monthEntries]);
  const allTimeTotals = useMemo(() => totals(entries), [entries]);
  const weekdayBuckets = useMemo(() => aggregateByWeekday(monthEntries), [monthEntries]);
  const monthLabel = formatMonthLabel(selectedMonth, lang);
  const breakdown = useMemo(() => monthlyBreakdown(entries), [entries]);
  const bestMonthDay = useMemo(() => bestDay(monthEntries), [monthEntries]);
  const goalPct = goal > 0 ? Math.min(100, Math.round((monthTotals.earnings / goal) * 100)) : 0;

  async function handleSubmit({ date, delivered, returns, tips }) {
    await upsertEntry(user.uid, date, { delivered, returns, tips, rate });
    setEditing(null);
  }

  async function handleDelete(entry) {
    if (confirm(t.dashboard.deleteConfirm(formatDateHuman(entry.id, lang)))) {
      await removeEntry(user.uid, entry.id);
    }
  }

  function handleExportCSV() {
    exportEntriesToCSV(monthEntries, { filename: `alpha-${selectedMonth}.csv` });
  }

  // Клик по логотипу «A ALPHA» в шапке (см. Header) всегда открывает окно
  // входа в режим администратора — независимо от того, под каким
  // сотрудником сейчас открыто приложение. Доступ к самой панели получает
  // только тот, кто ввёл верный email/пароль зарезервированного
  // администраторского аккаунта (проверка — в handleAdminLogin ниже).
  function handleLogoClick() {
    setAdminLoginOpen(true);
  }

  async function handleAdminLogin(login, password) {
    await adminLogin(login, password);
    setAdminLoginOpen(false);
    setAdminOpen(true);
  }

  if (adminOpen) {
    return <AdminPanel currentUid={user.uid} onClose={() => setAdminOpen(false)} />;
  }

  return (
    <div className="min-h-screen bg-bg pb-16">
      <Header
        userName={user?.displayName}
        rate={rate}
        onOpenRate={() => setRateModalOpen(true)}
        onOpenBalance={() => setBalanceModalOpen(true)}
        onLogout={logout}
        onLogoClick={handleLogoClick}
      />

      {adminLoginOpen && (
        <AdminLoginModal
          onLogin={handleAdminLogin}
          onClose={() => setAdminLoginOpen(false)}
        />
      )}

      <main className="max-w-5xl mx-auto px-4 sm:px-6 pt-6 space-y-6">
        {/* Главный счётчик — заработок за выбранный месяц */}
        <div className="relative bg-gradient-to-br from-panel to-panel2 border border-accent/30 rounded-xl2 shadow-card p-6 sm:p-8">
          {/* Счётчик чаевых за всё время — фиксирован в углу карточки */}
          <div
            className="absolute top-4 right-4 sm:top-6 sm:right-6 flex items-center gap-1.5 bg-accent/15 border border-accent/40 rounded-full pl-2.5 pr-3 py-1.5"
            title={t.dashboard.tipsAllTimeTitle}
          >
            <span className="text-base leading-none">🎁</span>
            <span className="text-accent font-bold text-xs sm:text-sm">
              {formatEuro(allTimeTotals.tips)}
            </span>
          </div>

          <span className="text-muted text-xs font-medium uppercase tracking-wide">
            {t.dashboard.earnedIn(monthLabel)}
          </span>
          <div className="text-4xl sm:text-6xl font-black text-white tracking-tight mt-2">
            {formatEuro(monthTotals.earnings)}
          </div>
          <div className="flex flex-wrap gap-x-6 gap-y-1 mt-4 text-sm text-muted">
            <span>
              📦 <span className="text-accent2 font-semibold">{monthTotals.delivered}</span>{" "}
              {t.dashboard.delivered}
            </span>
            <span>
              🎁 <span className="text-accent font-semibold">{formatEuro(monthTotals.tips)}</span>{" "}
              {t.dashboard.tips}
            </span>
            <span>
              ↩️ <span className="text-danger font-semibold">{monthTotals.returns}</span>{" "}
              {t.dashboard.returns}
            </span>
            <span>
              📅 <span className="text-white font-semibold">{monthTotals.days}</span>{" "}
              {t.dashboard.workDays}
            </span>
          </div>

          {/* Полоска прогресса к месячной цели */}
          <div className="mt-5 pt-4 border-t border-border/60">
            {goal > 0 ? (
              <>
                <div className="flex items-center justify-between text-xs text-muted mb-1.5">
                  <span>{t.dashboard.goalProgress(formatEuro(goal))}</span>
                  <button
                    onClick={() => setGoalModalOpen(true)}
                    className="text-accent hover:text-accent/80 font-semibold"
                  >
                    {t.dashboard.editGoal}
                  </button>
                </div>
                <div className="w-full h-2.5 rounded-full bg-panel2 border border-border overflow-hidden">
                  <div
                    className="h-full rounded-full bg-accent transition-all"
                    style={{ width: `${goalPct}%` }}
                  />
                </div>
                <div className="text-right text-xs text-muted mt-1">{goalPct}%</div>
              </>
            ) : (
              <button
                onClick={() => setGoalModalOpen(true)}
                className="text-xs font-semibold text-accent hover:text-accent/80 transition"
              >
                + {t.dashboard.setGoal}
              </button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          <StatCard
            label={t.dashboard.totalAllTime}
            value={formatEuro(allTimeTotals.earnings)}
            valueColor="text-white"
            icon="💶"
          />
          <StatCard
            label={t.dashboard.deliveredAllTime}
            value={allTimeTotals.delivered}
            valueColor="text-accent2"
            icon="📦"
          />
          <StatCard
            label={t.dashboard.tipsAllTime}
            value={formatEuro(allTimeTotals.tips)}
            valueColor="text-accent"
            icon="🎁"
          />
          <StatCard
            label={t.dashboard.returnsAllTime}
            value={allTimeTotals.returns}
            valueColor="text-danger"
            icon="↩️"
          />
          <StatCard
            label={t.dashboard.avgPerDay}
            value={formatEuro(allTimeTotals.days ? allTimeTotals.earnings / allTimeTotals.days : 0)}
            valueColor="text-accent"
            icon="📊"
          />
        </div>

        {bestMonthDay && (
          <div className="bg-panel border border-border rounded-xl2 shadow-card p-4 flex items-center gap-3 flex-wrap">
            <span className="text-xl">🏆</span>
            <span className="text-sm text-muted">
              {t.dashboard.bestDay(monthLabel)}{" "}
              <span className="text-white font-semibold">{formatDateShort(bestMonthDay.id)}</span> —{" "}
              <span className="text-accent2 font-semibold">
                {formatEuro(
                  Number(bestMonthDay.delivered) * Number(bestMonthDay.rate) + Number(bestMonthDay.tips || 0)
                )}
              </span>
            </span>
          </div>
        )}

        <EntryForm
          rate={rate}
          onSubmit={handleSubmit}
          existing={editing}
          onCancel={() => setEditing(null)}
        />

        <MonthTabs months={months} selected={selectedMonth} onSelect={setSelectedMonth} />

        {/* Графики за выбранный месяц */}
        <div>
          <h2 className="text-white font-bold text-lg mb-3">{t.dashboard.charts.title}</h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="bg-panel border border-border rounded-xl2 shadow-card p-5 lg:col-span-2">
              <h4 className="text-white font-semibold text-sm mb-2">{t.dashboard.charts.deliveredTrend}</h4>
              <TrendChart entries={monthEntries} />
            </div>
            <div className="bg-panel border border-border rounded-xl2 shadow-card p-5">
              <WeekdayBarChart
                buckets={weekdayBuckets}
                metric="delivered"
                color={{ strong: "#22c55e", soft: "#1c4a34" }}
                title={t.dashboard.charts.weekdayDelivered}
              />
            </div>
            <div className="bg-panel border border-border rounded-xl2 shadow-card p-5">
              <WeekdayBarChart
                buckets={weekdayBuckets}
                metric="returns"
                color={{ strong: "#ef4444", soft: "#4a2323" }}
                title={t.dashboard.charts.weekdayReturns}
              />
            </div>
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
            <h2 className="text-white font-bold text-lg">{t.dashboard.historyTitle(monthLabel)}</h2>
            {monthEntries.length > 0 && (
              <button
                onClick={handleExportCSV}
                className="text-xs font-semibold text-muted hover:text-accent border border-border hover:border-accent rounded-lg px-3 py-1.5 transition shrink-0"
              >
                ⬇ {t.dashboard.exportCSV}
              </button>
            )}
          </div>
          {loading ? (
            <div className="bg-panel border border-border rounded-xl2 p-8 text-center text-muted">
              {t.dashboard.loadingEntries}
            </div>
          ) : (
            <EntryList
              entries={monthEntries}
              onEdit={setEditing}
              onDelete={handleDelete}
              emptyMessage={t.dashboard.noEntriesMonth}
            />
          )}
        </div>
      </main>

      {rateModalOpen && (
        <RateModal
          currentRate={rate}
          onSave={(newRate) => setUserRate(user.uid, newRate)}
          onClose={() => setRateModalOpen(false)}
        />
      )}

      {goalModalOpen && (
        <GoalModal
          currentGoal={goal}
          onSave={(newGoal) => setUserGoal(user.uid, newGoal)}
          onClose={() => setGoalModalOpen(false)}
        />
      )}

      {balanceModalOpen && (
        <BalanceModal
          breakdown={breakdown}
          grandTotal={allTimeTotals}
          onClose={() => setBalanceModalOpen(false)}
        />
      )}
    </div>
  );
}
