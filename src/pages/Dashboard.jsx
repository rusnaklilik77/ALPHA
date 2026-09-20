import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { useLanguage } from "../context/LanguageContext";
import { useTour } from "../context/TourContext";
import {
  ensureUserDoc,
  subscribeUserSettings,
  subscribeEntries,
  upsertEntry,
  deleteEntry as removeEntry,
  setUserRate,
  setUserGoal,
  setMonthlyPay,
  subscribeMonthlyPay,
  upsertSorterEntry,
  setDriverWorked,
  unsetDriverWorked,
  normalizeRole,
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
  aggregateByWeek,
  currentMonthKey,
  monthlyBreakdown,
  bestDay,
  entryEarnings,
  formatHours,
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
import ScannerModal from "../components/ScannerModal";
import ExtraInfoModal from "../components/ExtraInfoModal";
import SosButton from "../components/SosButton";
import DriverDayPanel from "../components/DriverDayPanel";
import SorterEntryForm from "../components/SorterEntryForm";
import MonthlyPayModal from "../components/MonthlyPayModal";
import MonthTabs from "../components/MonthTabs";
import { TrendChart, WeekdayBarChart, DonutChart, DailyBarChart } from "../components/Charts";
import AdminPanel from "./AdminPanel";

export default function Dashboard() {
  const { user, logout } = useAuth();
  const { t, lang } = useLanguage();
  const { active: activeTour } = useTour();
  const [rate, setRate] = useState(DEFAULT_RATE);
  const [goal, setGoal] = useState(0);
  const [employeeId, setEmployeeId] = useState("");
  const [profileName, setProfileName] = useState("");
  const [phone, setPhone] = useState("");
  const [sos, setSos] = useState({ all: false, contacts: [], active: null });
  const [role, setRole] = useState("privat"); // privat | shop | driver | sorter
  const [scanToken, setScanToken] = useState("");
  const [adminOpen, setAdminOpen] = useState(false);
  const [adminLoginOpen, setAdminLoginOpen] = useState(false);
  const [entries, setEntries] = useState([]);
  const [monthlyPay, setMonthlyPayMap] = useState({});
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);
  const [rateModalOpen, setRateModalOpen] = useState(false);
  const [goalModalOpen, setGoalModalOpen] = useState(false);
  const [balanceModalOpen, setBalanceModalOpen] = useState(false);
  const [scannerModalOpen, setScannerModalOpen] = useState(false);
  const [extraOpen, setExtraOpen] = useState(false);
  const [extraTab, setExtraTab] = useState(null);
  const [monthlyPayModalOpen, setMonthlyPayModalOpen] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(currentMonthKey());

  useEffect(() => {
    if (!user) return;
    ensureUserDoc(user.uid);
    const unsubSettings = subscribeUserSettings(user.uid, (data) => {
      setRate(data.rate ?? DEFAULT_RATE);
      setGoal(data.goal ?? 0);
      setEmployeeId(data.employeeId ?? "");
      setProfileName(data.name ?? "");
      setPhone(data.phone ?? "");
      setRole(normalizeRole(data.role));
      setScanToken(data.scanToken ?? "");
      setSos({
        all: data.sosAll === true,
        contacts: Array.isArray(data.sosContacts) ? data.sosContacts : [],
        active: data.sosActive ?? null,
      });
    });
    const unsubEntries = subscribeEntries(user.uid, (data) => {
      setEntries(data);
      setLoading(false);
    });
    const unsubPay = subscribeMonthlyPay(user.uid, setMonthlyPayMap);
    return () => {
      unsubSettings();
      unsubEntries();
      unsubPay();
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

  // Везде ниже в totals/bestDay/monthlyBreakdown/aggregateByWeek передаём
  // текущую ставку (rate) вторым аргументом — это значит, что заработок
  // всегда считается по АКТУАЛЬНОЙ ставке из настроек, а не по той, что была
  // сохранена в записи в момент её создания. Поменял ставку 0.70 → 0.75 —
  // все суммы (счётчики, графики, история) пересчитываются мгновенно.
  const isShop = role === "shop";
  const isDriver = role === "driver";
  const isSorter = role === "sorter";
  const isParcel = !isDriver && !isSorter; // privat | shop
  const monthEntries = useMemo(() => entriesForMonth(entries, selectedMonth), [entries, selectedMonth]);
  const monthTotalsRaw = useMemo(() => totals(monthEntries, rate, role), [monthEntries, rate, role]);
  const allTimeTotalsRaw = useMemo(() => totals(entries, rate, role), [entries, rate, role]);
  const weekdayBuckets = useMemo(() => aggregateByWeekday(monthEntries), [monthEntries]);
  const weeklyBreakdown = useMemo(() => aggregateByWeek(monthEntries, rate, role), [monthEntries, rate, role]);
  const monthLabel = formatMonthLabel(selectedMonth, lang);
  const breakdown = useMemo(() => monthlyBreakdown(entries, rate, role), [entries, rate, role]);
  const bestMonthDay = useMemo(() => bestDay(monthEntries, rate, role), [monthEntries, rate, role]);

  // У курьеров на шопе нет ставки за посылку — заработок за месяц это то,
  // что они сами вписали в "Доход за месяц" (плюс чаевые, которые всегда
  // приходят отдельно от работодателя). Для приват-курьеров всё считается
  // как раньше: посылки × ставка + чаевые.
  const currentMonthlyPay = Number(monthlyPay[selectedMonth]) || 0;
  const totalMonthlyPayAllTime = useMemo(
    () => Object.values(monthlyPay).reduce((sum, v) => sum + (Number(v) || 0), 0),
    [monthlyPay]
  );
  // income — основной заработок БЕЗ чаевых (посылки × ставка для приват,
  // либо вручную введённый доход за месяц для шопа). earnings оставлен как
  // income+tips для мест, где осознанно нужна итоговая сумма на руки
  // (например, строка "лучший день"). На дашборде чаевые нигде не
  // прибавляются молча к основному доходу — по просьбе пользователя они
  // всегда отдельный, самостоятельный счётчик.
  const monthTotals = isShop
    ? { ...monthTotalsRaw, income: currentMonthlyPay, earnings: currentMonthlyPay + monthTotalsRaw.tips }
    : monthTotalsRaw;
  const allTimeTotals = isShop
    ? { ...allTimeTotalsRaw, income: totalMonthlyPayAllTime, earnings: totalMonthlyPayAllTime + allTimeTotalsRaw.tips }
    : allTimeTotalsRaw;
  // Разбивка "Общий баланс" по месяцам тоже пересчитывается под шоп-заработок,
  // подставляя фактический доход за каждый месяц вместо расчёта по ставке.
  const breakdownDisplay = isShop
    ? breakdown.map((m) => ({ ...m, income: Number(monthlyPay[m.key]) || 0, earnings: (Number(monthlyPay[m.key]) || 0) + m.tips }))
    : breakdown;
  const goalPct = goal > 0 ? Math.min(100, Math.round((monthTotals.income / goal) * 100)) : 0;

  async function handleSubmit({ date, totalParcels, delivered, returns, tips }) {
    await upsertEntry(user.uid, date, { totalParcels, delivered, returns, tips, rate });
    setEditing(null);
  }

  // Сортировщик: дата + часы
  async function handleSorterSubmit({ date, hours }) {
    await upsertSorterEntry(user.uid, date, { hours, rate });
    setEditing(null);
  }

  // Водитель: отметка / снятие отметки «отработал» за день
  async function handleSetWorked(dateStr) {
    await setDriverWorked(user.uid, dateStr, rate);
  }

  async function handleUnsetWorked(dateStr) {
    // Если в записи дня есть данные тура — сохраняем запись, снимаем только отметку
    const entry = entries.find((e) => e.id === dateStr);
    await unsetDriverWorked(user.uid, dateStr, !!entry?.tourFinish);
  }

  async function handleDelete(entry) {
    if (isDriver) {
      if (confirm(t.driverPanel.confirmUnmark(formatDateHuman(entry.id, lang)))) {
        await handleUnsetWorked(entry.id);
      }
      return;
    }
    if (confirm(t.dashboard.deleteConfirm(formatDateHuman(entry.id, lang)))) {
      await removeEntry(user.uid, entry.id);
    }
  }

  function handleExportCSV() {
    exportEntriesToCSV(monthEntries, { filename: `alpha-${selectedMonth}.csv`, rateOverride: rate, role });
  }

  function openExtra(tab = null) {
    setExtraTab(tab);
    setExtraOpen(true);
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

  // Для водителя в истории показываем только отработанные дни
  const historyEntries = isDriver ? monthEntries.filter((e) => e.worked === true) : monthEntries;
  const needsRate = (isDriver || isSorter) && Number(rate) <= 0;
  const avgHoursPerDay = monthTotals.days ? monthTotals.hours / monthTotals.days : 0;

  return (
    <div className="min-h-screen bg-bg pb-24">
      <Header
        userName={profileName || user?.displayName}
        rate={rate}
        role={role}
        monthlyPayAmount={currentMonthlyPay}
        onOpenRate={() => setRateModalOpen(true)}
        onOpenMonthlyPay={() => setMonthlyPayModalOpen(true)}
        onOpenBalance={() => setBalanceModalOpen(true)}
        onOpenScanner={isParcel ? () => setScannerModalOpen(true) : undefined}
        onOpenTourInfo={() => openExtra(null)}
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
        {/* Идёт тур — плашка с быстрым переходом к карте/завершению */}
        {activeTour && (
          <button
            type="button"
            onClick={() => openExtra("tour")}
            className="w-full flex items-center justify-between gap-3 bg-accent2/10 border border-accent2/40 rounded-xl2 px-4 py-3 text-left hover:bg-accent2/15 transition"
          >
            <span className="flex items-center gap-2.5 text-sm text-white font-semibold min-w-0">
              <span className="relative flex h-2.5 w-2.5 shrink-0">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent2 opacity-75" />
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-accent2" />
              </span>
              <span className="truncate">{t.dashboard.activeTour(t.tour.distance(activeTour.distanceM))}</span>
            </span>
            <span className="text-accent2 text-xs font-bold shrink-0">{t.dashboard.activeTourOpen} →</span>
          </button>
        )}

        {/* У водителя и сортировщика ставки поначалу нет — просим указать */}
        {needsRate && (
          <div className="flex items-center justify-between gap-3 flex-wrap bg-yellow-400/10 border border-yellow-400/40 rounded-xl2 px-4 py-3">
            <span className="text-sm text-yellow-200">{t.dashboard.setRateBanner(role)}</span>
            <button
              type="button"
              onClick={() => setRateModalOpen(true)}
              className="shrink-0 px-4 py-2 rounded-lg text-xs font-bold bg-accent hover:bg-accent/90 text-bg transition"
            >
              {t.dashboard.setRateButton}
            </button>
          </div>
        )}

        {/* Главный счётчик — заработок за выбранный месяц */}
        <div className="relative bg-gradient-to-br from-panel to-panel2 border border-accent/30 rounded-xl2 shadow-card p-6 sm:p-8">
          {/* Счётчик чаевых — за ВЫБРАННЫЙ месяц (не за всё время). Только у
              посылочных ролей — у водителя и сортировщика чаевых нет. */}
          {isParcel && (
            <div
              className="absolute top-4 right-4 sm:top-6 sm:right-6 flex items-center gap-1.5 bg-accent/15 border border-accent/40 rounded-full pl-2.5 pr-3 py-1.5"
              title={t.dashboard.tipsMonthTitle}
            >
              <span className="text-base leading-none">🎁</span>
              <span className="text-accent font-bold text-xs sm:text-sm">
                {formatEuro(monthTotals.tips)}
              </span>
            </div>
          )}

          <span className="text-muted text-xs font-medium uppercase tracking-wide">
            {t.dashboard.earnedIn(monthLabel)}
          </span>
          <div className="text-4xl sm:text-6xl font-black text-white tracking-tight mt-2">
            {formatEuro(monthTotals.income)}
          </div>
          {isParcel && <div className="text-muted/70 text-xs mt-1">{t.dashboard.excludesTips}</div>}
          <div className="flex flex-wrap gap-x-6 gap-y-1 mt-4 text-sm text-muted">
            {isParcel && (
              <>
                <span>
                  📦 <span className="text-accent2 font-semibold">{monthTotals.delivered}</span>{" "}
                  {t.dashboard.deliveredLabel(role)}
                </span>
                <span>
                  🎁 <span className="text-accent font-semibold">{formatEuro(monthTotals.tips)}</span>{" "}
                  {t.dashboard.tips}
                </span>
                <span>
                  ↩️ <span className="text-danger font-semibold">{monthTotals.returns}</span>{" "}
                  {t.dashboard.returnsLabel(role)}
                </span>
              </>
            )}
            {isSorter && (
              <span>
                ⏱ <span className="text-accent2 font-semibold">{formatHours(monthTotals.hours)}</span>{" "}
                {t.dashboard.hoursLabel}
              </span>
            )}
            {isDriver ? (
              <span>
                ✅ <span className="text-accent2 font-semibold">{monthTotals.days}</span>{" "}
                {t.dashboard.workedDaysLabel}
              </span>
            ) : (
              <span>
                📅 <span className="text-white font-semibold">{monthTotals.days}</span>{" "}
                {t.dashboard.workDays}
              </span>
            )}
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

        {/* Единственный накопительный счётчик в этой строке — общий заработок
            за всё время. Остальные карточки показывают ТЕКУЩИЙ выбранный
            месяц и в начале нового месяца автоматически стартуют с нуля;
            вся история по прошлым месяцам никуда не пропадает — она доступна
            через вкладки месяцев (MonthTabs) и окно "Общий баланс". */}
        {isParcel && (
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
            <StatCard
              label={t.dashboard.totalAllTime}
              value={formatEuro(allTimeTotals.income)}
              valueColor="text-white"
              icon="💶"
            />
            <StatCard
              label={t.dashboard.deliveredMonth}
              value={monthTotals.delivered}
              valueColor="text-accent2"
              icon="📦"
            />
            <StatCard
              label={t.dashboard.tipsMonth}
              value={formatEuro(monthTotals.tips)}
              valueColor="text-accent"
              icon="🎁"
            />
            <StatCard
              label={t.dashboard.returnsMonth}
              value={monthTotals.returns}
              valueColor="text-danger"
              icon="↩️"
            />
            <StatCard
              label={t.dashboard.avgPerDay}
              value={formatEuro(monthTotals.days ? monthTotals.income / monthTotals.days : 0)}
              valueColor="text-accent"
              icon="📊"
            />
          </div>
        )}
        {isDriver && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              label={t.dashboard.totalAllTime}
              value={formatEuro(allTimeTotals.income)}
              valueColor="text-white"
              icon="💶"
            />
            <StatCard
              label={t.dashboard.workedDaysMonth}
              value={monthTotals.days}
              valueColor="text-accent2"
              icon="✅"
            />
            <StatCard
              label={t.dashboard.workedDaysAll}
              value={allTimeTotals.days}
              valueColor="text-accent"
              icon="📅"
            />
            <StatCard
              label={t.dashboard.rateDayCard}
              value={formatEuro(rate)}
              valueColor="text-white"
              icon="💵"
            />
          </div>
        )}
        {isSorter && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              label={t.dashboard.totalAllTime}
              value={formatEuro(allTimeTotals.income)}
              valueColor="text-white"
              icon="💶"
            />
            <StatCard
              label={t.dashboard.hoursMonth}
              value={formatHours(monthTotals.hours)}
              valueColor="text-accent2"
              icon="⏱"
            />
            <StatCard
              label={t.dashboard.avgHoursPerDay}
              value={formatHours(avgHoursPerDay)}
              valueColor="text-accent"
              icon="📊"
            />
            <StatCard
              label={t.dashboard.avgPerDay}
              value={formatEuro(monthTotals.days ? monthTotals.income / monthTotals.days : 0)}
              valueColor="text-white"
              icon="💶"
            />
          </div>
        )}

        {bestMonthDay && !isDriver && (
          <div className="bg-panel border border-border rounded-xl2 shadow-card p-4 flex items-center gap-3 flex-wrap">
            <span className="text-xl">🏆</span>
            <span className="text-sm text-muted">
              {t.dashboard.bestDay(monthLabel)}{" "}
              <span className="text-white font-semibold">{formatDateShort(bestMonthDay.id)}</span> —{" "}
              <span className="text-accent2 font-semibold">
                {formatEuro(entryEarnings(bestMonthDay, rate, role))}
              </span>
            </span>
          </div>
        )}

        {isParcel && (
          <EntryForm
            rate={rate}
            role={role}
            onSubmit={handleSubmit}
            existing={editing}
            onCancel={() => setEditing(null)}
          />
        )}
        {isSorter && (
          <SorterEntryForm
            rate={rate}
            onSubmit={handleSorterSubmit}
            existing={editing}
            onCancel={() => setEditing(null)}
          />
        )}
        {isDriver && (
          <DriverDayPanel
            entries={entries}
            rate={rate}
            selectedMonth={selectedMonth}
            onSetWorked={handleSetWorked}
            onUnsetWorked={handleUnsetWorked}
          />
        )}

        <MonthTabs months={months} selected={selectedMonth} onSelect={setSelectedMonth} />

        {/* По неделям: месяц копится постепенно — как только появляются записи
            за очередную неделю, для неё сразу же считается своя сумма, а весь
            блок обновляется в реальном времени по ходу месяца. */}
        <div>
          <h2 className="text-white font-bold text-lg mb-3">{t.dashboard.weekly.title}</h2>
          {weeklyBreakdown.length === 0 ? (
            <div className="bg-panel border border-border rounded-xl2 p-6 text-center text-muted text-sm">
              {t.dashboard.charts.noData}
            </div>
          ) : (
            <div className="bg-panel border border-border rounded-xl2 shadow-card overflow-hidden divide-y divide-border">
              {weeklyBreakdown.map((w) => (
                <div
                  key={w.week}
                  className="flex items-center justify-between gap-3 px-5 py-3.5 flex-wrap"
                >
                  <div>
                    <div className="text-white font-semibold text-sm">
                      {t.dashboard.weekly.week(w.week)}
                    </div>
                    <div className="text-muted text-xs mt-0.5">
                      {t.dashboard.weekly.range(w.from, w.to)}
                      {isParcel && (
                        <>
                          {" "}· 📦 <span className="text-accent2 font-semibold">{w.delivered}</span> · 🎁{" "}
                          <span className="text-accent font-semibold">{formatEuro(w.tips)}</span> · ↩️{" "}
                          <span className="text-danger font-semibold">{w.returns}</span>
                        </>
                      )}
                      {isDriver && (
                        <>
                          {" "}· ✅ <span className="text-accent2 font-semibold">{w.days}</span>
                        </>
                      )}
                      {isSorter && (
                        <>
                          {" "}· ⏱{" "}
                          <span className="text-accent2 font-semibold">{formatHours(w.hours)}</span>{" "}
                          {t.dashboard.hoursShort}
                        </>
                      )}
                    </div>
                  </div>
                  <div className="text-white font-bold text-base shrink-0">{formatEuro(w.earnings)}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Графики за выбранный месяц */}
        {isParcel && (
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
              <div className="bg-panel border border-border rounded-xl2 shadow-card p-5">
                <WeekdayBarChart
                  buckets={weekdayBuckets}
                  metric="tips"
                  color={{ strong: "#eab308", soft: "#4a3f1c" }}
                  title={t.dashboard.charts.weekdayTips}
                  formatValue={(v) => `${v.toFixed(2)}€`}
                />
              </div>
              <div className="bg-panel border border-border rounded-xl2 shadow-card p-5 flex flex-col items-center">
                <h4 className="text-white font-semibold text-sm mb-2 self-start">
                  {t.dashboard.charts.donutTitle(monthLabel)}
                </h4>
                <DonutChart delivered={monthTotals.delivered} returns={monthTotals.returns} />
              </div>
            </div>
          </div>
        )}
        {isSorter && (
          <div>
            <h2 className="text-white font-bold text-lg mb-3">{t.dashboard.charts.title}</h2>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="bg-panel border border-border rounded-xl2 shadow-card p-5 lg:col-span-2">
                <DailyBarChart entries={monthEntries} metric="hours" title={t.dashboard.charts.hoursTrend} />
              </div>
              <div className="bg-panel border border-border rounded-xl2 shadow-card p-5">
                <WeekdayBarChart
                  buckets={weekdayBuckets}
                  metric="hours"
                  color={{ strong: "#22c55e", soft: "#1c4a34" }}
                  title={t.dashboard.charts.weekdayHours}
                />
              </div>
            </div>
          </div>
        )}

        <div>
          <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
            <h2 className="text-white font-bold text-lg">{t.dashboard.historyTitle(monthLabel)}</h2>
            {historyEntries.length > 0 && (
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
              entries={historyEntries}
              rate={rate}
              role={role}
              onEdit={setEditing}
              onDelete={handleDelete}
              emptyMessage={t.dashboard.noEntriesMonth}
            />
          )}
        </div>
      </main>

      {/* Красная кнопка SOS — всегда под рукой */}
      <SosButton
        uid={user.uid}
        profile={{ name: profileName || user.displayName || "", phone, employeeId }}
        sos={sos}
        onChooseContacts={() => openExtra("sos")}
      />

      {rateModalOpen && (
        <RateModal
          currentRate={rate}
          role={role}
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
          breakdown={breakdownDisplay}
          grandTotal={allTimeTotals}
          role={role}
          onClose={() => setBalanceModalOpen(false)}
        />
      )}

      {monthlyPayModalOpen && (
        <MonthlyPayModal
          monthLabel={monthLabel}
          currentAmount={currentMonthlyPay}
          onSave={(amount) => setMonthlyPay(user.uid, selectedMonth, amount)}
          onClose={() => setMonthlyPayModalOpen(false)}
        />
      )}

      {scannerModalOpen && isParcel && (
        <ScannerModal
          uid={user.uid}
          scanToken={scanToken}
          onClose={() => setScannerModalOpen(false)}
        />
      )}

      {extraOpen && (
        <ExtraInfoModal
          user={user}
          role={role}
          profile={{ name: profileName || user.displayName || "", employeeId, phone }}
          sos={sos}
          canTour={!isSorter}
          initialTab={extraTab}
          onClose={() => setExtraOpen(false)}
        />
      )}
    </div>
  );
}
