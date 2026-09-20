import { entryEarnings, formatDateHuman, formatEuro, formatHours, formatTimeShort, mapsLink } from "../lib/utils";
import { useLanguage } from "../context/LanguageContext";

// История по дням. Колонки зависят от роли:
//   privat / shop — отдано, возвраты, чаевые, заработок;
//   driver        — статус «отработан» и заработок за день;
//   sorter        — часы и заработок.
export default function EntryList({ entries, rate, role = "privat", onEdit, onDelete, emptyMessage, readOnly = false }) {
  const { t, lang } = useLanguage();

  const isDriver = role === "driver";
  const isSorter = role === "sorter";

  // Водителю показываем только реально отработанные дни (запись может
  // существовать и без отметки — например, ради данных тура).
  const rows = isDriver ? entries.filter((e) => e.worked === true) : entries;

  if (!rows.length) {
    return (
      <div className="bg-panel border border-border rounded-xl2 p-8 text-center text-muted">
        {emptyMessage || t.dashboard.noEntries}
      </div>
    );
  }

  // Сетка колонок. Классы Tailwind написаны целиком (а не собираются из
  // кусков), иначе сборщик стилей их не увидит и колонки не применятся.
  const few = isDriver || isSorter; // дата + 2 колонки
  const headGrid = few
    ? readOnly
      ? "grid-cols-[1fr_1fr_1fr]"
      : "grid-cols-[1fr_1fr_1fr_auto]"
    : readOnly
      ? "grid-cols-[1fr_1fr_1fr_1fr_1fr]"
      : "grid-cols-[1fr_1fr_1fr_1fr_1fr_auto]";
  const rowGrid = few
    ? readOnly
      ? "sm:grid-cols-[1fr_1fr_1fr]"
      : "sm:grid-cols-[1fr_1fr_1fr_auto]"
    : readOnly
      ? "sm:grid-cols-[1fr_1fr_1fr_1fr_1fr]"
      : "sm:grid-cols-[1fr_1fr_1fr_1fr_1fr_auto]";

  return (
    <div className="bg-panel border border-border rounded-xl2 shadow-card overflow-hidden">
      <div
        className={`hidden sm:grid gap-3 px-5 py-3 text-xs uppercase tracking-wide text-muted font-medium border-b border-border ${headGrid}`}
      >
        <span>{t.entryList.date}</span>
        {isDriver && (
          <>
            <span>{t.entryList.worked}</span>
            <span>{t.entryList.earnings}</span>
          </>
        )}
        {isSorter && (
          <>
            <span>{t.entryList.hours}</span>
            <span>{t.entryList.earnings}</span>
          </>
        )}
        {!isDriver && !isSorter && (
          <>
            <span>{t.entryList.deliveredLabel(role)}</span>
            <span>{t.entryList.returnsLabel(role)}</span>
            <span>{t.entryList.tips}</span>
            <span>{t.entryList.earnings}</span>
          </>
        )}
        {!readOnly && <span></span>}
      </div>
      <div className="divide-y divide-border">
        {rows.map((e) => (
          <div
            key={e.id}
            className={`grid grid-cols-2 gap-2 sm:gap-3 px-5 py-4 items-center hover:bg-panel2/60 transition ${rowGrid}`}
          >
            <div className="col-span-2 sm:col-span-1">
              <div className="text-white font-semibold text-sm sm:text-base">{formatDateHuman(e.id, lang)}</div>
              <div className="text-muted text-xs flex flex-wrap gap-x-2">
                <span className="sm:hidden">
                  {t.entryList.rate} {Number(rate != null ? rate : e.rate).toFixed(2)} €
                </span>
                {!isDriver && !isSorter && Number(e.totalParcels) > 0 && (
                  <span>
                    📦 {t.entryList.totalParcels}: <span className="text-white">{e.totalParcels}</span>
                  </span>
                )}
                {/* Место и время завершения тура ("Доп. сведения" через шестерёнку) —
                    видно и самому сотруднику, и админу в его карточке. */}
                {e.tourFinish && (
                  <a
                    href={mapsLink(e.tourFinish.lat, e.tourFinish.lng)}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(ev) => ev.stopPropagation()}
                    className="text-accent hover:underline"
                  >
                    📍 {t.entryList.tourFinish}: {formatTimeShort(e.tourFinish.finishedAt)}
                  </a>
                )}
              </div>
            </div>

            {isDriver && (
              <div className="text-accent2 font-semibold">
                <span className="sm:hidden text-muted text-xs mr-1 font-normal">{t.entryList.worked}:</span>✓{" "}
                {t.entryList.workedDay}
              </div>
            )}
            {isSorter && (
              <div className="text-accent2 font-semibold">
                <span className="sm:hidden text-muted text-xs mr-1 font-normal">{t.entryList.hours}:</span>
                {formatHours(e.hours)} {t.dashboard.hoursShort}
              </div>
            )}
            {!isDriver && !isSorter && (
              <>
                <div className="text-accent2 font-semibold">
                  <span className="sm:hidden text-muted text-xs mr-1 font-normal">{t.entryList.delivered}:</span>
                  {e.delivered}
                </div>
                <div className="text-danger font-semibold">
                  <span className="sm:hidden text-muted text-xs mr-1 font-normal">{t.entryList.returns}:</span>
                  {e.returns}
                </div>
                <div className="text-accent font-semibold">
                  <span className="sm:hidden text-muted text-xs mr-1 font-normal">{t.entryList.tips}:</span>
                  {formatEuro(e.tips || 0)}
                </div>
              </>
            )}
            <div className="text-white font-bold">
              <span className="sm:hidden text-muted text-xs mr-1 font-normal">{t.entryList.earnings}:</span>
              {formatEuro(entryEarnings(e, rate, role))}
            </div>
            {!readOnly && (
              <div className="col-span-2 sm:col-span-1 flex gap-2 justify-end">
                {/* Водителю «Изменить» не нужно — отметка ставится/снимается в календаре */}
                {!isDriver && (
                  <button
                    onClick={() => onEdit(e)}
                    className="text-xs font-semibold text-muted hover:text-accent border border-border hover:border-accent rounded-lg px-3 py-1.5 transition"
                  >
                    {t.entryList.edit}
                  </button>
                )}
                <button
                  onClick={() => onDelete(e)}
                  className="text-xs font-semibold text-muted hover:text-danger border border-border hover:border-danger rounded-lg px-3 py-1.5 transition"
                >
                  {isDriver ? t.driverPanel.undo : t.entryList.delete}
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
