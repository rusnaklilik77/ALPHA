import { useState } from "react";
import { updateProfile } from "firebase/auth";
import { auth } from "../firebase";
import { useLanguage } from "../context/LanguageContext";
import { setUserProfile, isValidPhone } from "../lib/data";

// Вкладка «Профиль» — «Мои настройки»: имя, ID, email, телефон и функция.
// Email и роль только показываются: смена email в Firebase требует
// повторного входа, а роль влияет на всю статистику.
export default function ProfileTab({ uid, email, role, profile }) {
  const { t } = useLanguage();
  const [name, setName] = useState(profile.name || "");
  const [employeeId, setEmployeeId] = useState(profile.employeeId || "");
  const [phone, setPhone] = useState(profile.phone || "");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState(""); // "" | "saved" | error text

  const roleLabel = t.admin.roleLabel(role);

  async function handleSave(e) {
    e.preventDefault();
    setStatus("");
    if (!employeeId.trim()) {
      setStatus(t.profile.idRequired);
      return;
    }
    if (!isValidPhone(phone)) {
      setStatus(t.profile.phoneInvalid);
      return;
    }
    setBusy(true);
    try {
      await setUserProfile(uid, { name, employeeId, phone });
      // Имя в профиле Auth — чтобы совпадало с Firestore
      try {
        if (auth.currentUser) await updateProfile(auth.currentUser, { displayName: name.trim() });
      } catch {
        // не критично
      }
      setStatus("saved");
    } catch {
      setStatus(t.profile.saveError);
    } finally {
      setBusy(false);
    }
  }

  const inputCls =
    "w-full bg-panel2 border border-border rounded-lg px-3 py-2.5 text-white placeholder:text-muted/60 outline-none focus:border-accent transition";

  return (
    <form onSubmit={handleSave} className="space-y-4">
      <div>
        <h4 className="text-white font-semibold">{t.profile.title}</h4>
        <p className="text-muted text-xs mt-1">{t.profile.description}</p>
      </div>

      <div>
        <label className="block text-xs font-medium text-muted mb-1.5">{t.profile.name}</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className={inputCls}
          autoComplete="name"
        />
      </div>

      <div>
        <label className="block text-xs font-medium text-muted mb-1.5">{t.profile.employeeId}</label>
        <input
          type="text"
          inputMode="numeric"
          value={employeeId}
          onChange={(e) => setEmployeeId(e.target.value)}
          className={inputCls}
        />
      </div>

      <div>
        <label className="block text-xs font-medium text-muted mb-1.5">{t.profile.email}</label>
        <input type="email" value={email || ""} readOnly className={`${inputCls} opacity-60 cursor-not-allowed`} />
        <p className="text-muted/70 text-[11px] mt-1">{t.profile.emailNote}</p>
      </div>

      <div>
        <label className="block text-xs font-medium text-muted mb-1.5">{t.profile.phone}</label>
        <input
          type="tel"
          inputMode="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          className={inputCls}
          placeholder={t.auth.phonePlaceholder}
          autoComplete="tel"
        />
      </div>

      <div>
        <label className="block text-xs font-medium text-muted mb-1.5">{t.profile.role}</label>
        <div className="bg-panel2/60 border border-border/60 rounded-lg px-3 py-2.5 text-white text-sm">{roleLabel}</div>
      </div>

      {status && (
        <div
          className={`text-sm rounded-lg px-3 py-2 border ${
            status === "saved"
              ? "text-accent2 bg-accent2/10 border-accent2/30"
              : "text-danger bg-danger/10 border-danger/30"
          }`}
        >
          {status === "saved" ? t.profile.saved : status}
        </div>
      )}

      <button
        type="submit"
        disabled={busy}
        className="w-full px-4 py-2.5 rounded-lg text-sm font-bold bg-accent hover:bg-accent/90 disabled:opacity-60 text-bg transition"
      >
        {busy ? t.profile.saving : t.profile.save}
      </button>
    </form>
  );
}
