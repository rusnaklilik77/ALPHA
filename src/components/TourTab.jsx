import { useEffect, useState } from "react";
import { useLanguage } from "../context/LanguageContext";
import { useTour } from "../context/TourContext";
import { deleteTour } from "../lib/data";
import { formatTimeShort } from "../lib/utils";
import ToursList from "./ToursList";
import RouteMapModal from "./RouteMapModal";

// Вкладка «Тур» в окне «Доп. сведения»: начать тур -> приложение пишет
// маршрут по GPS -> завершить тур -> карта с линией пути, стартом и финишем.
export default function TourTab({ uid }) {
  const { t } = useLanguage();
  const {
    active,
    phase,
    errorKey,
    tours,
    wakeLockOk,
    justFinished,
    clearJustFinished,
    startTour,
    finishTour,
  } = useTour();
  const [routeView, setRouteView] = useState(null); // { tour, live }
  const [now, setNow] = useState(() => Date.now());

  // Секундомер «в пути» тикает, только пока тур идёт
  useEffect(() => {
    if (!active) return;
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [active?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Как только тур завершён — сразу показываем карту с маршрутом
  useEffect(() => {
    if (justFinished) {
      setRouteView({ tour: justFinished, live: false });
      clearJustFinished();
    }
  }, [justFinished, clearJustFinished]);

  async function handleDelete(tour) {
    if (confirm(t.tour.deleteConfirm)) {
      try {
        await deleteTour(uid, tour.id);
      } catch {
        // ignore
      }
    }
  }

  const busy = phase !== "idle";

  return (
    <div>
      <p className="text-muted text-sm mb-4">{t.tour.description}</p>

      <div className="bg-panel2 border border-border rounded-xl2 p-4 mb-4">
        {active ? (
          <div>
            <div className="flex items-center gap-2 text-white font-semibold text-sm mb-3">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent2 opacity-75" />
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-accent2" />
              </span>
              {t.tour.activeTitle}
              <span className="text-muted font-normal text-xs">· {t.tour.startedAt(formatTimeShort(active.startedAt))}</span>
            </div>

            <div className="grid grid-cols-3 gap-2 mb-3">
              <div className="bg-panel border border-border rounded-lg px-3 py-2">
                <div className="text-muted text-[10px] uppercase tracking-wide">{t.tour.distanceLabel}</div>
                <div className="text-white font-bold text-sm">{t.tour.distance(active.distanceM)}</div>
              </div>
              <div className="bg-panel border border-border rounded-lg px-3 py-2">
                <div className="text-muted text-[10px] uppercase tracking-wide">{t.tour.durationLabel}</div>
                <div className="text-white font-bold text-sm">
                  {t.tour.duration(now - new Date(active.startedAt).getTime())}
                </div>
              </div>
              <div className="bg-panel border border-border rounded-lg px-3 py-2">
                <div className="text-muted text-[10px] uppercase tracking-wide">{t.tour.pointsLabel}</div>
                <div className="text-white font-bold text-sm">{active.points.length}</div>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-2">
              <button
                type="button"
                onClick={() => setRouteView({ tour: active, live: true })}
                className="flex-1 px-4 py-2.5 rounded-lg text-sm font-semibold border border-accent/40 text-accent hover:bg-accent/10 transition"
              >
                🗺️ {t.tour.showLive}
              </button>
              <button
                type="button"
                onClick={finishTour}
                disabled={busy}
                className="flex-1 px-4 py-2.5 rounded-lg text-sm font-bold bg-danger hover:bg-danger/90 disabled:opacity-60 text-white transition"
              >
                {phase === "finishing" ? t.tour.finishing : `🏁 ${t.tour.finish}`}
              </button>
            </div>

            <p className="text-muted/80 text-[11px] mt-3">{t.tour.keepOpenHint}</p>
            {!wakeLockOk && <p className="text-yellow-400/90 text-[11px] mt-1">{t.tour.wakeLockNo}</p>}
          </div>
        ) : (
          <div>
            <button
              type="button"
              onClick={startTour}
              disabled={busy}
              className="w-full px-4 py-3 rounded-lg text-sm font-bold bg-accent2 hover:bg-accent2/90 disabled:opacity-60 text-bg transition"
            >
              {phase === "starting" ? t.tour.starting : `▶ ${t.tour.start}`}
            </button>
            <p className="text-muted/70 text-[11px] mt-2">{t.tour.geoHint}</p>
          </div>
        )}

        {errorKey && (
          <p className="text-danger text-xs mt-3 bg-danger/10 border border-danger/30 rounded-lg px-3 py-2">
            {t.tour[errorKey] || t.tour.geoUnavailable}
          </p>
        )}
      </div>

      <div className="text-xs uppercase tracking-wide text-muted font-medium mb-2">{t.tour.historyTitle}</div>
      <ToursList
        tours={tours}
        activeId={active?.id}
        onShow={(tour) => setRouteView({ tour, live: false })}
        onDelete={handleDelete}
      />

      {routeView && (
        <RouteMapModal tour={routeView.live ? active || routeView.tour : routeView.tour} live={routeView.live} onClose={() => setRouteView(null)} />
      )}
    </div>
  );
}
