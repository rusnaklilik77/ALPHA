import { useEffect, useRef, useState } from "react";
import { useLanguage } from "../context/LanguageContext";
import lionLogo from "../assets/lion-logo.png";

export default function Header({
  userName,
  rate,
  role = "privat",
  monthlyPayAmount = 0,
  onOpenRate,
  onOpenMonthlyPay,
  onOpenBalance,
  onOpenScanner,
  onLogout,
  onLogoClick,
}) {
  const { t, lang, setLang, langs } = useLanguage();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    if (!menuOpen) return;
    const onClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setMenuOpen(false);
      }
    };
    const onEsc = (e) => {
      if (e.key === "Escape") setMenuOpen(false);
    };
    document.addEventListener("mousedown", onClickOutside);
    document.addEventListener("keydown", onEsc);
    return () => {
      document.removeEventListener("mousedown", onClickOutside);
      document.removeEventListener("keydown", onEsc);
    };
  }, [menuOpen]);

  // Close the mobile menu automatically if the viewport grows past the sm breakpoint
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 640px)");
    const handler = (e) => {
      if (e.matches) setMenuOpen(false);
    };
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  return (
    <header ref={menuRef} className="sticky top-0 z-30 bg-bg/90 backdrop-blur border-b border-border">
      <div className="max-w-5xl mx-auto px-3 sm:px-6 py-3 sm:py-4 flex items-center justify-between gap-2 sm:gap-3">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <button
            type="button"
            onClick={onLogoClick}
            className="w-9 h-9 rounded-xl bg-accent/15 border border-accent/30 flex items-center justify-center shrink-0 cursor-pointer select-none overflow-hidden"
          >
            <img src={lionLogo} alt="Admin" className="w-full h-full object-contain p-0.5" />
          </button>
          <div className="min-w-0">
            <div className="text-white font-bold leading-tight truncate">{t.app.name}</div>
            <div className="text-muted text-xs truncate">
              {userName ? t.header.greeting(userName) : ""}
            </div>
          </div>
        </div>

        {/* Desktop / tablet controls */}
        <div className="hidden sm:flex items-center gap-2 shrink-0">
          <label className="sr-only" htmlFor="lang-select">
            {t.header.language}
          </label>
          <select
            id="lang-select"
            value={lang}
            onChange={(e) => setLang(e.target.value)}
            title={t.header.language}
            className="text-xs sm:text-sm font-semibold bg-panel2 hover:bg-panel border border-border rounded-lg px-2 py-2 text-white outline-none focus:border-accent transition cursor-pointer"
          >
            {langs.map((l) => (
              <option key={l.code} value={l.code}>
                {l.label}
              </option>
            ))}
          </select>
          <button
            onClick={onOpenBalance}
            className="text-xs sm:text-sm font-semibold bg-accent/15 hover:bg-accent/25 border border-accent/40 rounded-lg px-3 py-2 text-accent transition"
            title={t.header.balanceTitle}
          >
            {t.header.balance}
          </button>
          {role === "shop" ? (
            <button
              onClick={onOpenMonthlyPay}
              className="text-xs sm:text-sm font-semibold bg-panel2 hover:bg-panel border border-border rounded-lg px-3 py-2 text-white transition"
              title={t.header.monthlyPayTitle}
            >
              {t.header.monthlyPay(monthlyPayAmount)}
            </button>
          ) : (
            <button
              onClick={onOpenRate}
              className="text-xs sm:text-sm font-semibold bg-panel2 hover:bg-panel border border-border rounded-lg px-3 py-2 text-white transition"
              title={t.header.rateTitle}
            >
              {t.header.rate(Number(rate).toFixed(2))}
            </button>
          )}
          {onOpenScanner && (
            <button
              onClick={onOpenScanner}
              className="text-xs sm:text-sm font-semibold bg-panel2 hover:bg-panel border border-border rounded-lg px-3 py-2 text-white transition"
              title={t.header.scannerTitle}
            >
              📷 {t.header.scanner}
            </button>
          )}
          <button
            onClick={onLogout}
            className="text-xs sm:text-sm font-semibold text-muted hover:text-danger border border-border hover:border-danger rounded-lg px-3 py-2 transition"
          >
            {t.header.logout}
          </button>
        </div>

        {/* Mobile hamburger toggle */}
        <button
          type="button"
          onClick={() => setMenuOpen((v) => !v)}
          aria-expanded={menuOpen}
          aria-label={t.header.language}
          className="sm:hidden shrink-0 w-10 h-10 rounded-lg bg-panel2 hover:bg-panel border border-border flex items-center justify-center text-white transition"
        >
          {menuOpen ? (
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M2 2l14 14M16 2L2 16" />
            </svg>
          ) : (
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M1 4h16M1 9h16M1 14h16" />
            </svg>
          )}
        </button>
      </div>

      {/* Mobile dropdown panel */}
      {menuOpen && (
        <div className="sm:hidden border-t border-border bg-bg/95 backdrop-blur px-3 pb-3 pt-2">
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between gap-2">
              <label className="text-muted text-xs font-semibold" htmlFor="lang-select-mobile">
                {t.header.language}
              </label>
              <select
                id="lang-select-mobile"
                value={lang}
                onChange={(e) => setLang(e.target.value)}
                className="text-sm font-semibold bg-panel2 hover:bg-panel border border-border rounded-lg px-2 py-2 text-white outline-none focus:border-accent transition cursor-pointer"
              >
                {langs.map((l) => (
                  <option key={l.code} value={l.code}>
                    {l.label}
                  </option>
                ))}
              </select>
            </div>
            <button
              onClick={() => {
                onOpenBalance();
                setMenuOpen(false);
              }}
              className="w-full text-left text-sm font-semibold bg-accent/15 hover:bg-accent/25 border border-accent/40 rounded-lg px-3 py-2.5 text-accent transition"
              title={t.header.balanceTitle}
            >
              {t.header.balance}
            </button>
            {role === "shop" ? (
              <button
                onClick={() => {
                  onOpenMonthlyPay();
                  setMenuOpen(false);
                }}
                className="w-full text-left text-sm font-semibold bg-panel2 hover:bg-panel border border-border rounded-lg px-3 py-2.5 text-white transition"
                title={t.header.monthlyPayTitle}
              >
                {t.header.monthlyPay(monthlyPayAmount)}
              </button>
            ) : (
              <button
                onClick={() => {
                  onOpenRate();
                  setMenuOpen(false);
                }}
                className="w-full text-left text-sm font-semibold bg-panel2 hover:bg-panel border border-border rounded-lg px-3 py-2.5 text-white transition"
                title={t.header.rateTitle}
              >
                {t.header.rate(Number(rate).toFixed(2))}
              </button>
            )}
            {onOpenScanner && (
              <button
                onClick={() => {
                  onOpenScanner();
                  setMenuOpen(false);
                }}
                className="w-full text-left text-sm font-semibold bg-panel2 hover:bg-panel border border-border rounded-lg px-3 py-2.5 text-white transition"
                title={t.header.scannerTitle}
              >
                📷 {t.header.scanner}
              </button>
            )}
            <button
              onClick={() => {
                onLogout();
                setMenuOpen(false);
              }}
              className="w-full text-left text-sm font-semibold text-muted hover:text-danger border border-border hover:border-danger rounded-lg px-3 py-2.5 transition"
            >
              {t.header.logout}
            </button>
          </div>
        </div>
      )}
    </header>
  );
}
