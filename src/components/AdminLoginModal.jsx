import { useState } from "react";
import { useLanguage } from "../context/LanguageContext";
import lionLogo from "../assets/lion-logo.png";

// Всплывающее окно, которое открывается по клику на логотип «A ALPHA» в
// шапке. Вход в режим администратора не зависит от того, под каким
// сотрудником сейчас открыто приложение — доступ получает только тот, кто
// знает email и пароль зарезервированного аккаунта администратора.
export default function AdminLoginModal({ onLogin, onClose }) {
  const { t } = useLanguage();
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  function friendlyError(code) {
    if (code === "not-admin") return t.adminLogin.notAdmin;
    if (code === "invalid-login") return t.adminLogin.invalidLogin;
    return t.auth.errors[code] || t.auth.errors.default;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      await onLogin(login, password);
    } catch (err) {
      setError(friendlyError(err.code));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center px-4 z-50"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-panel border border-border rounded-xl2 shadow-card p-6 w-full max-w-sm">
        <div className="flex items-center gap-3 mb-1">
          <div className="w-9 h-9 rounded-xl bg-accent/15 border border-accent/30 flex items-center justify-center shrink-0 overflow-hidden">
            <img src={lionLogo} alt="Alpha" className="w-full h-full object-contain p-0.5" />
          </div>
          <h3 className="text-white font-bold text-lg">{t.adminLogin.title}</h3>
        </div>
        <p className="text-muted text-sm mb-5">{t.adminLogin.description}</p>

        <form onSubmit={handleSubmit}>
          <label className="block text-xs font-medium text-muted mb-1.5">
            {t.adminLogin.email}
          </label>
          <input
            type="text"
            autoComplete="username"
            required
            autoFocus
            placeholder={t.adminLogin.loginPlaceholder}
            value={login}
            onChange={(e) => setLogin(e.target.value)}
            className="w-full bg-panel2 border border-border rounded-lg px-3 py-2.5 text-white placeholder:text-muted/50 outline-none focus:border-accent transition mb-4"
          />

          <label className="block text-xs font-medium text-muted mb-1.5">
            {t.adminLogin.password}
          </label>
          <input
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full bg-panel2 border border-border rounded-lg px-3 py-2.5 text-white outline-none focus:border-accent transition"
          />

          {error && <p className="text-danger text-xs mt-3">{error}</p>}

          <div className="flex gap-2 justify-end mt-5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-sm font-semibold text-muted hover:text-white border border-border transition"
            >
              {t.adminLogin.cancel}
            </button>
            <button
              type="submit"
              disabled={busy}
              className="px-5 py-2 rounded-lg text-sm font-bold bg-accent hover:bg-accent/90 disabled:opacity-60 text-bg transition"
            >
              {busy ? t.adminLogin.busy : t.adminLogin.submit}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
