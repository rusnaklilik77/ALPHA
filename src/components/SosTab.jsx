import { useEffect, useMemo, useState } from "react";
import { useLanguage } from "../context/LanguageContext";
import { subscribeAllUsers, setSosContacts } from "../lib/data";

// Вкладка «SOS»: заранее выбираем, кому отправлять сигнал — всем
// зарегистрированным или только отдельным людям. Сохраняется сразу, при
// каждом клике (в users/{uid}: sosAll, sosContacts).
export default function SosTab({ uid, sosAll, sosContacts }) {
  const { t } = useLanguage();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [notifState, setNotifState] = useState(() =>
    typeof Notification === "undefined" ? "unsupported" : Notification.permission
  );

  useEffect(() => {
    return subscribeAllUsers((list) => {
      setUsers(list.filter((u) => u.uid !== uid));
      setLoading(false);
    });
  }, [uid]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return users;
    return users.filter(
      (u) =>
        (u.name || "").toLowerCase().includes(q) || String(u.employeeId || "").toLowerCase().includes(q)
    );
  }, [users, query]);

  function toggleAll() {
    setSosContacts(uid, { all: !sosAll, contacts: sosContacts });
  }

  function toggleContact(id) {
    const next = sosContacts.includes(id) ? sosContacts.filter((x) => x !== id) : [...sosContacts, id];
    setSosContacts(uid, { all: sosAll, contacts: next });
  }

  async function askNotifications() {
    try {
      const res = await Notification.requestPermission();
      setNotifState(res);
    } catch {
      setNotifState("denied");
    }
  }

  // «Выбрано» считаем только по реально существующим пользователям
  const selectedCount = sosAll ? users.length : sosContacts.filter((id) => users.some((u) => u.uid === id)).length;

  return (
    <div>
      <div className="mb-4">
        <h4 className="text-white font-semibold">🆘 {t.sos.settingsTitle}</h4>
        <p className="text-muted text-xs mt-1">{t.sos.settingsDesc}</p>
      </div>

      <button
        type="button"
        onClick={toggleAll}
        className={`w-full flex items-center justify-between gap-3 rounded-xl2 border px-4 py-3 text-left transition mb-4 ${
          sosAll ? "bg-danger/15 border-danger/60" : "bg-panel2 border-border hover:border-danger/40"
        }`}
        aria-pressed={sosAll}
      >
        <div>
          <div className="text-white text-sm font-semibold">{t.sos.allToggle}</div>
          <div className="text-muted text-xs mt-0.5">{t.sos.allToggleHint}</div>
        </div>
        <span
          className={`shrink-0 w-11 h-6 rounded-full p-0.5 transition ${sosAll ? "bg-danger" : "bg-border"}`}
        >
          <span
            className={`block w-5 h-5 rounded-full bg-white transition-transform ${sosAll ? "translate-x-5" : ""}`}
          />
        </span>
      </button>

      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="text-xs uppercase tracking-wide text-muted font-medium">{t.sos.pickTitle}</div>
        <div className="text-xs text-accent font-semibold">{t.sos.selectedCount(selectedCount)}</div>
      </div>
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={t.sos.searchPlaceholder}
        className="w-full bg-panel2 border border-border rounded-lg px-3 py-2 text-sm text-white placeholder:text-muted/60 outline-none focus:border-accent transition mb-2"
      />

      <div className={`space-y-1.5 max-h-64 overflow-y-auto pr-1 ${sosAll ? "opacity-50" : ""}`}>
        {loading ? (
          <div className="text-muted text-sm text-center py-4">…</div>
        ) : users.length === 0 ? (
          <div className="text-muted text-sm text-center py-4">{t.sos.noUsers}</div>
        ) : filtered.length === 0 ? (
          <div className="text-muted text-sm text-center py-4">{t.sos.noResults}</div>
        ) : (
          filtered.map((u) => {
            const checked = sosAll || sosContacts.includes(u.uid);
            return (
              <label
                key={u.uid}
                className={`flex items-center gap-3 rounded-lg border px-3 py-2.5 cursor-pointer transition ${
                  checked ? "bg-accent/10 border-accent/40" : "bg-panel2 border-border hover:border-accent/30"
                } ${sosAll ? "pointer-events-none" : ""}`}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  disabled={sosAll}
                  onChange={() => toggleContact(u.uid)}
                  className="w-4 h-4 accent-[#0fb8ab] shrink-0"
                />
                <div className="min-w-0">
                  <div className="text-white text-sm font-semibold truncate">{u.name || t.sos.unnamed}</div>
                  <div className="text-muted text-xs truncate">
                    ID: {u.employeeId || "—"}
                    {u.phone ? ` · ${u.phone}` : ""}
                  </div>
                </div>
              </label>
            );
          })
        )}
      </div>

      <div className="bg-panel2 border border-border rounded-xl2 p-4 mt-4">
        <div className="text-white text-sm font-semibold">🔔 {t.sos.notifyTitle}</div>
        <p className="text-muted text-xs mt-1 mb-3">{t.sos.notifyDesc}</p>
        {notifState === "granted" && <div className="text-accent2 text-xs font-semibold">✓ {t.sos.notifyGranted}</div>}
        {notifState === "denied" && <div className="text-danger text-xs">{t.sos.notifyDenied}</div>}
        {notifState === "unsupported" && <div className="text-muted text-xs">{t.sos.notifyUnsupported}</div>}
        {notifState === "default" && (
          <button
            type="button"
            onClick={askNotifications}
            className="px-4 py-2 rounded-lg text-xs font-bold bg-accent hover:bg-accent/90 text-bg transition"
          >
            {t.sos.notifyAllow}
          </button>
        )}
      </div>

      <p className="text-muted/70 text-[11px] mt-3">{t.sos.limitNote}</p>
    </div>
  );
}
