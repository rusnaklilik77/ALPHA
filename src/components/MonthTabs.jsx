import { formatMonthLabel, currentMonthKey } from "../lib/utils";
import { useLanguage } from "../context/LanguageContext";

export default function MonthTabs({ months, selected, onSelect }) {
  const { t, lang } = useLanguage();
  const nowKey = currentMonthKey();

  return (
    <div>
      <h2 className="text-white font-bold text-lg mb-3">{t.dashboard.monthsTitle}</h2>
      <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-none">
        {months.map((key) => {
          const isSelected = key === selected;
          const isCurrent = key === nowKey;
          return (
            <button
              key={key}
              onClick={() => onSelect(key)}
              className={`shrink-0 whitespace-nowrap rounded-lg px-4 py-2 text-sm font-semibold border transition ${
                isSelected
                  ? "bg-accent text-bg border-accent"
                  : "bg-panel text-muted border-border hover:text-white hover:border-accent/50"
              }`}
            >
              {formatMonthLabel(key, lang)}
              {isCurrent && (
                <span
                  className={`ml-2 text-[10px] uppercase tracking-wide align-middle ${
                    isSelected ? "text-bg/70" : "text-accent"
                  }`}
                >
                  {t.dashboard.currentBadge}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
