import { lazy, Suspense, useMemo, useState } from "react";
import { useLanguage } from "../context/LanguageContext";
import { unflattenPoints } from "../lib/geo";
import { formatDateHuman, formatTimeShort, mapsLink } from "../lib/utils";

// Карта грузится отдельным куском (Leaflet весит ~150 КБ) — только когда
// человек открывает маршрут, а не при каждом запуске приложения.
const RouteMap = lazy(() => import("./RouteMap"));

// Окно «Маршрут тура»: карта с линией пути, стартом и финишем + цифры
// (пройдено, время в пути, во сколько начал/закончил).
// tour — документ из users/{uid}/tours (points хранятся плоским массивом pts)
// либо «живой» активный тур (points уже массив [lat,lng,t]).
export default function RouteMapModal({ tour, live = false, onClose }) {
  const { t, lang } = useLanguage();
  const [openedAt] = useState(() => Date.now());

  const points = useMemo(() => {
    if (Array.isArray(tour.points)) return tour.points;
    return unflattenPoints(tour.pts);
  }, [tour]);

  const labels = useMemo(
    () => ({ start: t.tour.startLabel, finish: t.tour.finishLabel, now: t.tour.lastPointLabel }),
    [t]
  );

  const isLive = live || tour.status === "active";
  const startMs = new Date(tour.startedAt).getTime();
  const endMs = tour.finishedAt ? new Date(tour.finishedAt).getTime() : openedAt;
  const distanceM = Number(tour.distanceM) || 0;
  const last = points[points.length - 1];

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center px-3 z-[60]">
      <div className="bg-panel border border-border rounded-xl2 shadow-card p-4 sm:p-5 w-full max-w-2xl max-h-[92vh] flex flex-col">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="min-w-0">
            <h3 className="text-white font-bold text-lg truncate">🗺️ {t.tour.routeTitle}</h3>
            <div className="text-muted text-xs">{tour.date ? formatDateHuman(tour.date, lang) : ""}</div>
          </div>
          <button
            onClick={onClose}
            className="text-muted hover:text-white shrink-0 w-8 h-8 flex items-center justify-center rounded-lg hover:bg-panel2 transition"
            aria-label={t.tour.close}
          >
            ✕
          </button>
        </div>

        <div className="grid grid-cols-3 gap-2 mb-3 shrink-0">
          <div className="bg-panel2 border border-border rounded-lg px-3 py-2">
            <div className="text-muted text-[10px] uppercase tracking-wide">{t.tour.distanceLabel}</div>
            <div className="text-white font-bold text-sm">{t.tour.distance(distanceM)}</div>
          </div>
          <div className="bg-panel2 border border-border rounded-lg px-3 py-2">
            <div className="text-muted text-[10px] uppercase tracking-wide">{t.tour.durationLabel}</div>
            <div className="text-white font-bold text-sm">{t.tour.duration(endMs - startMs)}</div>
          </div>
          <div className="bg-panel2 border border-border rounded-lg px-3 py-2">
            <div className="text-muted text-[10px] uppercase tracking-wide">
              {t.tour.startTime} → {isLive ? t.tour.lastPointLabel : t.tour.finishTime}
            </div>
            <div className="text-white font-bold text-sm">
              {formatTimeShort(tour.startedAt)}
              {tour.finishedAt ? ` → ${formatTimeShort(tour.finishedAt)}` : ""}
            </div>
          </div>
        </div>

        {points.length === 0 ? (
          <div className="text-muted text-sm text-center py-10">{t.tour.tooFewPoints}</div>
        ) : (
          <Suspense
            fallback={
              <div className="h-[55vh] flex items-center justify-center text-muted text-sm">{t.tour.mapLoading}</div>
            }
          >
            <RouteMap points={points} live={isLive} labels={labels} className="h-[55vh] min-h-[280px]" />
          </Suspense>
        )}

        <div className="flex items-center justify-between gap-3 mt-3 shrink-0 flex-wrap">
          {last ? (
            <a
              href={mapsLink(last[0], last[1])}
              target="_blank"
              rel="noopener noreferrer"
              className="text-accent text-xs font-semibold hover:underline"
            >
              📍 {t.tour.openInMaps}
            </a>
          ) : (
            <span />
          )}
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-lg text-sm font-bold bg-accent hover:bg-accent/90 text-bg transition"
          >
            {t.tour.close}
          </button>
        </div>
      </div>
    </div>
  );
}
