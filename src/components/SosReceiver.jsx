import { useEffect, useRef, useState } from "react";
import { useLanguage } from "../context/LanguageContext";
import { subscribeSosInbox, dismissSos } from "../lib/data";
import { startAlarm, stopAlarm, showSystemNotification } from "../lib/alarm";
import { formatTimeShort, mapsLink } from "../lib/utils";

const STALE_MS = 12 * 60 * 60 * 1000; // сигналам старше 12 часов не верим — это «хвосты»

// Приёмник SOS: слушает «почтовый ящик» users/{uid}/sosInbox в реальном
// времени. Как только кто-то из коллег нажал SOS и выбрал этого человека
// (или «всех»), здесь на весь экран всплывает красное окно «SOS от ...» с
// сиреной, вибрацией, телефоном отправителя и ссылкой на карту.
// Работает на любом экране приложения (в том числе в режиме администратора).
export default function SosReceiver({ uid }) {
  const { t } = useLanguage();
  const [alerts, setAlerts] = useState([]);
  const [muted, setMuted] = useState(false);
  const seenRef = useRef(new Set());

  useEffect(() => {
    return subscribeSosInbox(uid, (list) => {
      const now = Date.now();
      const fresh = [];
      for (const a of list) {
        const stale = a.active === false || now - (Number(a.sentAt) || 0) > STALE_MS;
        if (stale) {
          dismissSos(uid, a.id).catch(() => {});
        } else {
          fresh.push(a);
        }
      }
      fresh.sort((a, b) => (Number(b.sentAt) || 0) - (Number(a.sentAt) || 0));
      setAlerts(fresh);
    });
  }, [uid]);

  // Реакция на НОВЫЕ сигналы: сирена, вибрация, системное уведомление
  useEffect(() => {
    let hasNew = false;
    for (const a of alerts) {
      const key = `${a.id}:${a.sentAt}`;
      if (!seenRef.current.has(key)) {
        seenRef.current.add(key);
        hasNew = true;
        if (document.hidden) {
          showSystemNotification(
            t.sosPopup.notifTitle(a.fromName || t.sosPopup.unnamed),
            t.sosPopup.notifBody
          );
        }
      }
    }
    if (hasNew) {
      setMuted(false);
      startAlarm();
    }
    if (alerts.length === 0) stopAlarm();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [alerts]);

  useEffect(() => () => stopAlarm(), []);

  if (alerts.length === 0) return null;
  const a = alerts[0];
  const hasLocation = a.lat != null && a.lng != null;

  function handleMute() {
    stopAlarm();
    setMuted(true);
  }

  async function handleDismiss() {
    try {
      await dismissSos(uid, a.id);
    } catch {
      // Если удалить не удалось (нет сети) — просто скрываем локально
      setAlerts((prev) => prev.filter((x) => x.id !== a.id));
    }
  }

  return (
    <div className="alpha-sos-flash fixed inset-0 z-[90] flex items-center justify-center px-4 overflow-y-auto py-6">
      <div className="w-full max-w-sm bg-bg border-2 border-danger rounded-xl2 shadow-[0_0_60px_rgba(239,68,68,0.6)] p-6 text-center">
        <div className="text-6xl mb-2 animate-bounce">🆘</div>
        <div className="text-danger font-black text-4xl tracking-wider mb-2">{t.sosPopup.title}</div>
        <div className="text-white font-bold text-xl leading-tight mb-2 break-words">
          {t.sosPopup.fromLine(a.fromName || t.sosPopup.unnamed)}
        </div>
        <p className="text-muted text-sm mb-4">{t.sosPopup.subtitle}</p>

        <div className="bg-panel border border-border rounded-lg px-4 py-3 mb-3 text-left space-y-1">
          {a.fromEmployeeId ? (
            <div className="text-xs text-muted">
              ID: <span className="text-white font-semibold">{a.fromEmployeeId}</span>
            </div>
          ) : null}
          <div className="text-xs text-muted">
            {t.sosPopup.phone}:{" "}
            <span className="text-white font-semibold">{a.fromPhone || "—"}</span>
          </div>
          <div className="text-xs text-muted">{t.sosPopup.sentAt(formatTimeShort(new Date(Number(a.sentAt)).toISOString()))}</div>
        </div>

        <div className="flex flex-col gap-2">
          {a.fromPhone ? (
            <a
              href={`tel:${String(a.fromPhone).replace(/[^\d+]/g, "")}`}
              className="w-full px-4 py-3 rounded-lg text-sm font-black bg-accent2 hover:bg-accent2/90 text-bg transition"
            >
              📞 {t.sosPopup.call}
            </a>
          ) : null}
          {hasLocation ? (
            <a
              href={mapsLink(a.lat, a.lng)}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full px-4 py-3 rounded-lg text-sm font-bold bg-accent hover:bg-accent/90 text-bg transition"
            >
              📍 {t.sosPopup.showOnMap}
            </a>
          ) : (
            <div className="text-muted text-xs py-1">{t.sosPopup.noLocation}</div>
          )}
          {!muted && (
            <button
              type="button"
              onClick={handleMute}
              className="w-full px-4 py-2.5 rounded-lg text-sm font-semibold text-white border border-border hover:bg-panel2 transition"
            >
              🔇 {t.sosPopup.mute}
            </button>
          )}
          <button
            type="button"
            onClick={handleDismiss}
            className="w-full px-4 py-3 rounded-lg text-sm font-bold bg-danger hover:bg-red-600 text-white transition"
          >
            {t.sosPopup.dismiss}
          </button>
        </div>

        {alerts.length > 1 && (
          <div className="text-muted text-xs mt-3">{t.sosPopup.more(alerts.length - 1)}</div>
        )}
      </div>
    </div>
  );
}
