import { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { useLanguage } from "../context/LanguageContext";
import lionLogo from "../assets/lion-logo.png";

export default function Auth() {
  const { login, register } = useAuth();
  const { t, lang, setLang, langs } = useLanguage();
  const [mode, setMode] = useState("login"); // login | register
  const [name, setName] = useState("");
  const [employeeId, setEmployeeId] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  function friendlyError(code) {
    return t.auth.errors[code] || t.auth.errors.default;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      if (mode === "login") {
        await login(email, password);
      } else {
        await register(name, email, password, employeeId);
      }
    } catch (err) {
      setError(friendlyError(err.code));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-bg px-4">
      <div className="w-full max-w-sm">
        <div className="flex justify-end mb-3">
          <select
            value={lang}
            onChange={(e) => setLang(e.target.value)}
            title={t.header.language}
            className="text-xs font-semibold bg-panel2 hover:bg-panel border border-border rounded-lg px-2 py-1.5 text-white outline-none focus:border-accent transition cursor-pointer"
          >
            {langs.map((l) => (
              <option key={l.code} value={l.code}>
                {l.label}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col items-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-accent/15 border border-accent/30 flex items-center justify-center mb-4 overflow-hidden">
            <img src={lionLogo} alt="Alpha" className="w-full h-full object-contain p-1" />
          </div>
          <h1 className="text-2xl font-extrabold text-white tracking-tight">{t.app.name}</h1>
          <p className="text-muted text-sm mt-1">{t.app.tagline}</p>
        </div>

        <div className="bg-panel border border-border rounded-xl2 shadow-card p-6">
          <div className="flex bg-panel2 rounded-lg p-1 mb-6">
            <button
              type="button"
              onClick={() => setMode("login")}
              className={`flex-1 py-2 rounded-md text-sm font-semibold transition ${
                mode === "login" ? "bg-accent text-bg" : "text-muted hover:text-white"
              }`}
            >
              {t.auth.login}
            </button>
            <button
              type="button"
              onClick={() => setMode("register")}
              className={`flex-1 py-2 rounded-md text-sm font-semibold transition ${
                mode === "register" ? "bg-accent text-bg" : "text-muted hover:text-white"
              }`}
            >
              {t.auth.register}
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === "register" && (
              <div>
                <label className="block text-xs font-medium text-muted mb-1.5">{t.auth.name}</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-panel2 border border-border rounded-lg px-3 py-2.5 text-white placeholder:text-muted/60 outline-none focus:border-accent transition"
                  placeholder={t.auth.namePlaceholder}
                />
              </div>
            )}
            {mode === "register" && (
              <div>
                <label className="block text-xs font-medium text-muted mb-1.5">
                  {t.auth.employeeId}
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  required
                  value={employeeId}
                  onChange={(e) => setEmployeeId(e.target.value)}
                  className="w-full bg-panel2 border border-border rounded-lg px-3 py-2.5 text-white placeholder:text-muted/60 outline-none focus:border-accent transition"
                  placeholder={t.auth.employeeIdPlaceholder}
                />
              </div>
            )}
            <div>
              <label className="block text-xs font-medium text-muted mb-1.5">{t.auth.email}</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-panel2 border border-border rounded-lg px-3 py-2.5 text-white placeholder:text-muted/60 outline-none focus:border-accent transition"
                placeholder="you@example.com"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted mb-1.5">{t.auth.password}</label>
              <input
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-panel2 border border-border rounded-lg px-3 py-2.5 text-white placeholder:text-muted/60 outline-none focus:border-accent transition"
                placeholder={t.auth.passwordPlaceholder}
              />
            </div>

            {error && (
              <div className="text-sm text-danger bg-danger/10 border border-danger/30 rounded-lg px-3 py-2">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={busy}
              className="w-full bg-accent hover:bg-accent/90 disabled:opacity-60 text-bg font-bold py-2.5 rounded-lg transition"
            >
              {busy ? t.auth.busy : mode === "login" ? t.auth.submitLogin : t.auth.submitRegister}
            </button>
          </form>
        </div>

        <p className="text-center text-muted text-xs mt-6">{t.auth.footer}</p>
      </div>
    </div>
  );
}
