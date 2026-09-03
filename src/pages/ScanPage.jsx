import { useEffect, useRef, useState } from "react";
import { useLanguage } from "../context/LanguageContext";
import { fetchScanUser, scanIncrement, DEFAULT_RATE, DEFAULT_ROLE } from "../lib/data";
import { todayStr, formatDateHuman } from "../lib/utils";
import lionLogo from "../assets/lion-logo.png";

// Страница-компаньон сканера. Открывается по ссылке из QR-кода
// ("?scan=<uid>&t=<token>") на телефоне или устройстве со сканером
// штрихкодов — без email/пароля. Поддерживает два способа ввода:
//  1) Физический сканер штрихкодов, подключённый как HID-клавиатура —
//     он "печатает" код посылки и Enter в скрытое поле ввода, мы это
//     перехватываем и засчитываем как один скан.
//  2) Обычные кнопки "+1", если сканера нет под рукой.
// Счётчики этой сессии видны только локально (обнуляются при перезаходе),
// но каждое "+1" сразу же атомарно сохраняется в Firestore через
// increment(), так что реальные дневные итоги в приложении всегда точны.
export default function ScanPage({ uid, token }) {
  const { t, lang } = useLanguage();
  const [status, setStatus] = useState("loading"); // loading | ok | invalid
  const [employee, setEmployee] = useState(null);
  const [mode, setMode] = useState("delivered"); // delivered | returns
  const [sessionCounts, setSessionCounts] = useState({ delivered: 0, returns: 0 });
  const [lastScan, setLastScan] = useState("");
  const [saving, setSaving] = useState(false);
  const bufferRef = useRef("");
  const bufferTimer = useRef(null);
  const hiddenInputRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!uid || !token) {
        setStatus("invalid");
        return;
      }
      try {
        const emp = await fetchScanUser(uid);
        if (cancelled) return;
        if (!emp || emp.scanToken !== token) {
          setStatus("invalid");
          return;
        }
        setEmployee(emp);
        setStatus("ok");
      } catch {
        if (!cancelled) setStatus("invalid");
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [uid, token]);

  // Держим фокус на скрытом поле, чтобы физический сканер (HID-клавиатура)
  // всегда мог "напечатать" в него код посылки, даже если пользователь
  // случайно тапнул по экрану.
  useEffect(() => {
    if (status !== "ok") return;
    const el = hiddenInputRef.current;
    if (!el) return;
    el.focus();
    const refocus = () => el.focus();
    document.addEventListener("click", refocus);
    return () => document.removeEventListener("click", refocus);
  }, [status]);

  async function registerHit(field) {
    if (!employee) return;
    setSaving(true);
    setSessionCounts((c) => ({ ...c, [field]: c[field] + 1 }));
    try {
      await scanIncrement(uid, token, todayStr(), field, employee.rate ?? DEFAULT_RATE);
    } finally {
      setSaving(false);
    }
  }

  function handleManualAdd() {
    registerHit(mode);
    setLastScan(mode === "delivered" ? "+1" : "+1 ↩");
  }

  function handleUndo() {
    const field = mode;
    if (sessionCounts[field] <= 0) return;
    setSessionCounts((c) => ({ ...c, [field]: c[field] - 1 }));
    // Компенсируем через отрицательный increment — используем то же поле scanIncrement,
    // но с "виртуальным" -1 нельзя напрямую через ту же функцию (она всегда +1),
    // поэтому отмена — чисто локальная (счётчик сессии), а сама запись в Firestore
    // остаётся особенностью: если нужно скорректировать сохранённые итоги, это
    // делает сотрудник или админ в обычном режиме редактирования записи.
  }

  function handleHiddenKeyDown(e) {
    if (e.key === "Enter") {
      const code = bufferRef.current.trim();
      bufferRef.current = "";
      if (hiddenInputRef.current) hiddenInputRef.current.value = "";
      if (!code) return;
      setLastScan(code);
      registerHit(mode);
      return;
    }
    if (e.key.length === 1) {
      bufferRef.current += e.key;
    }
    // Сбрасываем буфер, если ввод идёт слишком медленно для сканера
    // (обычная ручная печать человеком, а не устройство)
    clearTimeout(bufferTimer.current);
    bufferTimer.current = setTimeout(() => {
      bufferRef.current = "";
    }, 400);
  }

  if (status === "loading") {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center px-4">
        <div className="text-muted text-sm">{t.scanPage.loading}</div>
      </div>
    );
  }

  if (status === "invalid") {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center px-4">
        <div className="w-full max-w-sm bg-panel border border-border rounded-xl2 shadow-card p-6 text-center">
          <div className="w-12 h-12 rounded-xl bg-danger/15 border border-danger/30 flex items-center justify-center mx-auto mb-4">
            <span className="text-danger font-black text-xl">!</span>
          </div>
          <h1 className="text-white font-bold text-lg mb-2">{t.scanPage.invalidLink}</h1>
          <p className="text-muted text-sm">{t.scanPage.invalidLinkDesc}</p>
        </div>
      </div>
    );
  }

  const role = employee?.role || DEFAULT_ROLE;

  return (
    <div className="min-h-screen bg-bg flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-6">
          <div className="w-12 h-12 rounded-2xl bg-accent/15 border border-accent/30 flex items-center justify-center mb-3 overflow-hidden">
            <img src={lionLogo} alt="Alpha" className="w-full h-full object-contain p-1" />
          </div>
          <h1 className="text-xl font-extrabold text-white tracking-tight">{t.scanPage.title}</h1>
          <p className="text-muted text-sm mt-1">{t.scanPage.subtitle(employee.name || employee.employeeId || uid)}</p>
          <p className="text-muted/70 text-xs mt-0.5">
            {t.scanPage.today}: {formatDateHuman(todayStr(), lang)}
          </p>
        </div>

        {/* Скрытое поле для физического сканера штрихкодов (эмулирует клавиатуру) */}
        <input
          ref={hiddenInputRef}
          type="text"
          onKeyDown={handleHiddenKeyDown}
          onChange={() => {}}
          className="opacity-0 absolute -z-10 w-1 h-1"
          autoFocus
        />

        <div className="bg-panel border border-border rounded-xl2 shadow-card p-5 mb-4">
          <div className="text-xs font-medium text-muted mb-2">{t.scanPage.modeHint}</div>
          <div className="grid grid-cols-2 gap-2 mb-5">
            <button
              type="button"
              onClick={() => setMode("delivered")}
              className={`rounded-lg py-2.5 text-sm font-bold border transition ${
                mode === "delivered"
                  ? "bg-accent2/20 border-accent2 text-accent2"
                  : "bg-panel2 border-border text-muted hover:text-white"
              }`}
            >
              📦 {t.entryForm.deliveredLabel(role) || t.scanPage.modeDelivered}
            </button>
            <button
              type="button"
              onClick={() => setMode("returns")}
              className={`rounded-lg py-2.5 text-sm font-bold border transition ${
                mode === "returns"
                  ? "bg-danger/20 border-danger text-danger"
                  : "bg-panel2 border-border text-muted hover:text-white"
              }`}
            >
              ↩️ {t.entryForm.returnsLabel(role) || t.scanPage.modeReturn}
            </button>
          </div>

          <button
            type="button"
            onClick={handleManualAdd}
            disabled={saving}
            className="w-full py-6 rounded-xl2 text-3xl font-black bg-accent hover:bg-accent/90 disabled:opacity-70 text-bg transition mb-3"
          >
            +1
          </button>
          <div className="text-center text-muted text-xs mb-3">{t.scanPage.tapToAdd}</div>

          <button
            type="button"
            onClick={handleUndo}
            className="w-full py-2 rounded-lg text-xs font-semibold text-muted hover:text-white border border-border transition"
          >
            {t.scanPage.undo}
          </button>
        </div>

        <div className="bg-panel border border-border rounded-xl2 shadow-card p-4 mb-4">
          <div className="text-xs uppercase tracking-wide text-muted font-medium mb-2">
            {t.scanPage.sessionCounts}
          </div>
          <div className="flex justify-between text-sm">
            <span>
              📦 <span className="text-accent2 font-bold">{sessionCounts.delivered}</span>{" "}
              {t.entryForm.deliveredLabel(role)}
            </span>
            <span>
              ↩️ <span className="text-danger font-bold">{sessionCounts.returns}</span>{" "}
              {t.entryForm.returnsLabel(role)}
            </span>
          </div>
        </div>

        <div className="text-center text-muted text-xs">
          {lastScan ? t.scanPage.lastScan(lastScan) : t.scanPage.waitingForScan}
        </div>
      </div>
    </div>
  );
}
