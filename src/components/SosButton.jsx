import { useState } from "react";
import { useLanguage } from "../context/LanguageContext";
import { fetchAllUserUids, sendSos, cancelSos } from "../lib/data";

// Быстрый замер геопозиции для SOS: ждём не дольше 5 секунд (сигнал важнее
// точности) и допускаем «свежую» позицию из кэша до минуты давности.
function quickPosition() {
  return new Promise((resolve) => {
    if (!navigator.geolocation) return resolve(null);
    const timer = setTimeout(() => resolve(null), 5500);
    navigator.geolocation.getCurrentPosition(
      (p) => {
        clearTimeout(timer);
        resolve({ lat: p.coords.latitude, lng: p.coords.longitude, accuracy: p.coords.accuracy });
      },
      () => {
        clearTimeout(timer);
        resolve(null);
      },
      { enableHighAccuracy: true, timeout: 5000, maximumAge: 60000 }
    );
  });
}

// Красная кнопка SOS (плавающая, в правом нижнем углу).
// Чтобы она сработала, получателей нужно выбрать заранее (Доп. сведения → SOS).
// Нажатие -> окно подтверждения (защита от случайного нажатия) -> сигнал уходит
// выбранным людям и у них на весь экран всплывает окно SOS.
export default function SosButton({ uid, profile, sos, onChooseContacts }) {
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null); // { sent, hasLocation }

  const hasContacts = sos.all || sos.contacts.length > 0;
  const isActive = !!sos.active;

  function openSheet() {
    setError("");
    setResult(null);
    setOpen(true);
  }

  function closeSheet() {
    if (busy) return;
    setOpen(false);
    setResult(null);
    setError("");
  }

  async function handleSend() {
    setBusy(true);
    setError("");
    try {
      const [location, targets] = await Promise.all([
        quickPosition(),
        sos.all ? fetchAllUserUids() : Promise.resolve(sos.contacts),
      ]);
      const recipients = targets.filter((x) => x && x !== uid);
      if (recipients.length === 0) {
        setError(t.sos.noRecipients);
        return;
      }
      const res = await sendSos(uid, profile, recipients, location);
      setResult({ sent: res.sent, hasLocation: !!location });
    } catch (err) {
      console.error("[ALPHA] sendSos:", err);
      setError(t.sos.sendError);
    } finally {
      setBusy(false);
    }
  }

  async function handleCancel() {
    setBusy(true);
    setError("");
    try {
      await cancelSos(uid, sos.active?.targets || []);
      setOpen(false);
      setResult(null);
    } catch (err) {
      console.error("[ALPHA] cancelSos:", err);
      setError(t.sos.sendError);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={openSheet}
        title={t.sos.buttonTitle}
        aria-label={t.sos.buttonTitle}
        className={`fixed bottom-5 right-4 sm:right-6 z-40 w-16 h-16 rounded-full bg-danger hover:bg-red-600 text-white font-black text-lg tracking-wide shadow-[0_6px_24px_rgba(239,68,68,0.55)] border-2 border-white/25 flex items-center justify-center transition active:scale-95 ${
          isActive ? "alpha-sos-pulse" : ""
        }`}
      >
        SOS
      </button>

      {open && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center px-4 z-[70]">
          <div className="bg-panel border border-danger/40 rounded-xl2 shadow-card p-6 w-full max-w-sm">
            {result ? (
              <>
                <div className="text-4xl text-center mb-2">✅</div>
                <h3 className="text-white font-bold text-lg text-center mb-1">{t.sos.sentTitle}</h3>
                <p className="text-muted text-sm text-center">{t.sos.sentText(result.sent)}</p>
                <p className={`text-xs text-center mt-2 ${result.hasLocation ? "text-accent2" : "text-yellow-400"}`}>
                  {result.hasLocation ? t.sos.locationAttached : t.sos.locationMissing}
                </p>
                <button
                  onClick={closeSheet}
                  className="mt-5 w-full px-4 py-2.5 rounded-lg text-sm font-bold bg-panel2 hover:bg-border border border-border text-white transition"
                >
                  {t.sos.close}
                </button>
              </>
            ) : isActive ? (
              <>
                <div className="text-4xl text-center mb-2">🆘</div>
                <h3 className="text-white font-bold text-lg text-center mb-1">{t.sos.activeLabel}</h3>
                <p className="text-muted text-sm text-center mb-5">
                  {t.sos.sentText((sos.active.targets || []).length)}
                </p>
                {error && <p className="text-danger text-xs text-center mb-3">{error}</p>}
                <button
                  onClick={handleCancel}
                  disabled={busy}
                  className="w-full px-4 py-3 rounded-lg text-sm font-bold bg-accent2 hover:bg-accent2/90 disabled:opacity-60 text-bg transition"
                >
                  {busy ? t.sos.canceling : t.sos.cancelSos}
                </button>
                <button
                  onClick={handleSend}
                  disabled={busy}
                  className="mt-2 w-full px-4 py-2.5 rounded-lg text-sm font-semibold text-danger border border-danger/40 hover:bg-danger/10 disabled:opacity-60 transition"
                >
                  {busy ? t.sos.sending : t.sos.send}
                </button>
                <button
                  onClick={closeSheet}
                  disabled={busy}
                  className="mt-2 w-full px-4 py-2 rounded-lg text-sm font-semibold text-muted hover:text-white transition"
                >
                  {t.sos.close}
                </button>
              </>
            ) : !hasContacts ? (
              <>
                <div className="text-4xl text-center mb-2">🆘</div>
                <h3 className="text-white font-bold text-lg text-center mb-1">{t.sos.needContactsTitle}</h3>
                <p className="text-muted text-sm text-center mb-5">{t.sos.needContactsText}</p>
                <button
                  onClick={() => {
                    setOpen(false);
                    onChooseContacts();
                  }}
                  className="w-full px-4 py-3 rounded-lg text-sm font-bold bg-accent hover:bg-accent/90 text-bg transition"
                >
                  {t.sos.chooseContacts}
                </button>
                <button
                  onClick={closeSheet}
                  className="mt-2 w-full px-4 py-2 rounded-lg text-sm font-semibold text-muted hover:text-white transition"
                >
                  {t.sos.cancel}
                </button>
              </>
            ) : (
              <>
                <div className="text-4xl text-center mb-2">🆘</div>
                <h3 className="text-white font-bold text-lg text-center mb-1">{t.sos.confirmTitle}</h3>
                <p className="text-muted text-sm text-center">
                  {sos.all ? t.sos.confirmToAll : t.sos.confirmToSome(sos.contacts.length)}
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setOpen(false);
                    onChooseContacts();
                  }}
                  className="block mx-auto mt-2 text-xs font-semibold text-accent hover:underline"
                >
                  {t.sos.changeContacts}
                </button>
                {error && <p className="text-danger text-xs text-center mt-3">{error}</p>}
                <button
                  onClick={handleSend}
                  disabled={busy}
                  className="mt-5 w-full px-4 py-3.5 rounded-lg text-base font-black bg-danger hover:bg-red-600 disabled:opacity-60 text-white transition"
                >
                  {busy ? t.sos.sending : `🆘 ${t.sos.send}`}
                </button>
                <button
                  onClick={closeSheet}
                  disabled={busy}
                  className="mt-2 w-full px-4 py-2.5 rounded-lg text-sm font-semibold text-muted hover:text-white border border-border transition"
                >
                  {t.sos.cancel}
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
