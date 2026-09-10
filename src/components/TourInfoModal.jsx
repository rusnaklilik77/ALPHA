import { useState } from "react";
import { useLanguage } from "../context/LanguageContext";
import { setTourFinish, clearTourFinish } from "../lib/data";
import { todayStr, formatDateHuman, formatTimeShort, mapsLink } from "../lib/utils";

// "Доп. сведения" — открывается по шестерёнке в шапке, доступно КАЖДОМУ
// вошедшему сотруднику (не только админу). Главная функция: "Завершить
// тур" — запрашивает геолокацию телефона и сохраняет, где и во сколько
// сотрудник закончил сегодняшний маршрут, прямо в записи за сегодня
// (entries/{today}.tourFinish). Эти же данные потом видно и в режиме
// администратора — см. EntryList (колонка/значок 📍) и AdminPanel.
export default function TourInfoModal({ uid, entries = [], onClose }) {
  const { t, lang } = useLanguage();
  const [geoState, setGeoState] = useState("idle"); // idle | locating | error
  const [geoError, setGeoError] = useState("");

  const today = todayStr();
  const todayEntry = entries.find((e) => e.id === today);
  const todayFinish = todayEntry?.tourFinish || null;

  // Последние несколько дней с записями — чтобы видеть историю завершений
  // тура, а не только сегодняшний день.
  const recentWithData = [...entries]
    .sort((a, b) => (a.id < b.id ? 1 : -1))
    .slice(0, 7);

  function handleFinishTour() {
    if (!navigator.geolocation) {
      setGeoState("error");
      setGeoError(t.tourInfo.geoUnsupported);
      return;
    }
    setGeoState("locating");
    setGeoError("");
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          await setTourFinish(uid, today, {
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            accuracy: pos.coords.accuracy,
          });
          setGeoState("idle");
        } catch (err) {
          setGeoState("error");
          setGeoError(err?.message || t.tourInfo.geoSaveError);
        }
      },
      (err) => {
        setGeoState("error");
        setGeoError(err?.message || t.tourInfo.geoDenied);
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  }

  async function handleUndo() {
    await clearTourFinish(uid, today);
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center px-4 z-50">
      <div className="bg-panel border border-border rounded-xl2 shadow-card p-6 w-full max-w-md max-h-[85vh] flex flex-col">
        <div className="flex items-start justify-between gap-3 mb-1">
          <h3 className="text-white font-bold text-lg">⚙️ {t.tourInfo.title}</h3>
          <button
            onClick={onClose}
            className="text-muted hover:text-white shrink-0 w-8 h-8 flex items-center justify-center rounded-lg hover:bg-panel2 transition"
            aria-label={t.tourInfo.close}
          >
            ✕
          </button>
        </div>
        <p className="text-muted text-sm mb-4">{t.tourInfo.description}</p>

        {/* Сегодняшний статус + кнопка завершения тура */}
        <div className="bg-panel2 border border-border rounded-xl2 p-4 mb-4 shrink-0">
          <div className="text-xs uppercase tracking-wide text-muted font-medium mb-2">
            {t.tourInfo.todayLabel(formatDateHuman(today, lang))}
          </div>

          {todayFinish ? (
            <div>
              <div className="text-white font-semibold text-sm mb-1">
                ✅ {t.tourInfo.finishedAt(formatTimeShort(todayFinish.finishedAt))}
              </div>
              <a
                href={mapsLink(todayFinish.lat, todayFinish.lng)}
                target="_blank"
                rel="noopener noreferrer"
                className="text-accent text-xs font-semibold hover:underline"
              >
                📍 {t.tourInfo.viewOnMap}
              </a>
              <button
                type="button"
                onClick={handleUndo}
                className="block mt-2 text-xs font-semibold text-muted hover:text-danger transition"
              >
                {t.tourInfo.undo}
              </button>
            </div>
          ) : (
            <div>
              <button
                type="button"
                onClick={handleFinishTour}
                disabled={geoState === "locating"}
                className="w-full px-4 py-2.5 rounded-lg text-sm font-bold bg-accent hover:bg-accent/90 disabled:opacity-60 text-bg transition"
              >
                {geoState === "locating" ? t.tourInfo.locating : `📍 ${t.tourInfo.finishTour}`}
              </button>
              {geoState === "error" && (
                <p className="text-danger text-xs mt-2">{geoError || t.tourInfo.geoDenied}</p>
              )}
              <p className="text-muted/70 text-[11px] mt-2">{t.tourInfo.geoHint}</p>
            </div>
          )}
        </div>

        {/* История за последние дни */}
        <div className="text-xs uppercase tracking-wide text-muted font-medium mb-2">
          {t.tourInfo.historyTitle}
        </div>
        <div className="overflow-y-auto -mx-1 px-1 space-y-2">
          {recentWithData.length === 0 && (
            <div className="text-muted text-sm text-center py-4">{t.tourInfo.historyEmpty}</div>
          )}
          {recentWithData.map((e) => (
            <div
              key={e.id}
              className="flex items-center justify-between gap-3 bg-panel2 border border-border rounded-lg px-4 py-2.5"
            >
              <div className="text-white text-sm font-semibold">{formatDateHuman(e.id, lang)}</div>
              {e.tourFinish ? (
                <a
                  href={mapsLink(e.tourFinish.lat, e.tourFinish.lng)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-accent text-xs font-semibold hover:underline shrink-0"
                >
                  📍 {formatTimeShort(e.tourFinish.finishedAt)}
                </a>
              ) : (
                <span className="text-muted/60 text-xs shrink-0">{t.tourInfo.noFinish}</span>
              )}
            </div>
          ))}
        </div>

        <button
          onClick={onClose}
          className="mt-5 w-full px-4 py-2.5 rounded-lg text-sm font-bold bg-accent hover:bg-accent/90 text-bg transition shrink-0"
        >
          {t.tourInfo.close}
        </button>
      </div>
    </div>
  );
}
