import { useLanguage } from "../context/LanguageContext";
import { formatDateHuman, formatTimeShort } from "../lib/utils";

// Список записанных туров (для сотрудника и для админа). Клик по «Маршрут»
// открывает карту с линией пути, стартом и финишем.
export default function ToursList({ tours, activeId = null, onShow, onDelete, emptyMessage }) {
  const { t, lang } = useLanguage();
  const list = tours.filter((x) => x.id !== activeId);

  if (list.length === 0) {
    return (
      <div className="text-muted text-sm text-center py-4">{emptyMessage || t.tour.historyEmpty}</div>
    );
  }

  return (
    <div className="space-y-2">
      {list.map((tour) => {
        const inProgress = tour.status === "active";
        const pointsCount = Array.isArray(tour.pts) ? Math.floor(tour.pts.length / 3) : 0;
        return (
          <div
            key={tour.id}
            className="flex items-center justify-between gap-3 bg-panel2 border border-border rounded-lg px-4 py-2.5"
          >
            <div className="min-w-0">
              <div className="text-white text-sm font-semibold truncate">
                {tour.date ? formatDateHuman(tour.date, lang) : "—"}
                {inProgress && (
                  <span className="ml-2 text-[10px] uppercase tracking-wide text-accent2 border border-accent2/40 bg-accent2/10 rounded-full px-2 py-0.5 align-middle">
                    {t.tour.inProgressBadge}
                  </span>
                )}
              </div>
              <div className="text-muted text-xs">
                {formatTimeShort(tour.startedAt)}
                {tour.finishedAt ? ` → ${formatTimeShort(tour.finishedAt)}` : ""} ·{" "}
                {t.tour.distance(Number(tour.distanceM) || 0)}
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {pointsCount > 0 && (
                <button
                  type="button"
                  onClick={() => onShow(tour)}
                  className="text-xs font-semibold text-accent hover:text-accent/80 border border-accent/40 hover:border-accent rounded-lg px-3 py-1.5 transition"
                >
                  🗺️ {t.tour.showRoute}
                </button>
              )}
              {onDelete && (
                <button
                  type="button"
                  onClick={() => onDelete(tour)}
                  className="text-xs font-semibold text-muted hover:text-danger border border-border hover:border-danger rounded-lg px-2.5 py-1.5 transition"
                  title={t.tour.deleteTour}
                  aria-label={t.tour.deleteTour}
                >
                  ✕
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
