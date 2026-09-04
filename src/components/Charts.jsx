import { useLanguage } from "../context/LanguageContext";

// ---------- Кольцевая диаграмма: отдано (зелёным) vs возвраты (красным) ----------
// Показывает соотношение за выбранный месяц одним взглядом — в центре общее
// число посылок (отдано + возвраты), вокруг — два цветных сегмента кольца.
// Используется и на дашборде сотрудника, и в режиме администратора у каждого
// сотрудника отдельно.
export function DonutChart({ delivered = 0, returns = 0, size = 176 }) {
  const { t } = useLanguage();
  const d = Math.max(0, Number(delivered) || 0);
  const r = Math.max(0, Number(returns) || 0);
  const total = d + r;

  const radius = 44;
  const stroke = 16;
  const circumference = 2 * Math.PI * radius;
  const deliveredFrac = total > 0 ? d / total : 0;
  const returnsFrac = total > 0 ? r / total : 0;
  const deliveredLen = circumference * deliveredFrac;
  const returnsLen = circumference * returnsFrac;
  const deliveredPct = total > 0 ? Math.round(deliveredFrac * 100) : 0;
  const returnsPct = total > 0 ? Math.round(returnsFrac * 100) : 0;

  return (
    <div className="flex flex-col items-center">
      <div className="relative" style={{ width: size, height: size }}>
        <svg viewBox="0 0 120 120" width={size} height={size}>
          <circle cx="60" cy="60" r={radius} fill="none" stroke="#1f2937" strokeWidth={stroke} />
          {total > 0 && (
            <>
              {/* Возвраты — красный сегмент */}
              <circle
                cx="60"
                cy="60"
                r={radius}
                fill="none"
                stroke="#ef4444"
                strokeWidth={stroke}
                strokeDasharray={`${returnsLen} ${circumference - returnsLen}`}
                strokeDashoffset={0}
                transform="rotate(-90 60 60)"
                strokeLinecap="butt"
              />
              {/* Отдано — зелёный сегмент, начинается сразу после красного */}
              <circle
                cx="60"
                cy="60"
                r={radius}
                fill="none"
                stroke="#22c55e"
                strokeWidth={stroke}
                strokeDasharray={`${deliveredLen} ${circumference - deliveredLen}`}
                strokeDashoffset={-returnsLen}
                transform="rotate(-90 60 60)"
                strokeLinecap="butt"
              />
            </>
          )}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-white font-black text-xl sm:text-2xl leading-none">{total}</span>
          <span className="text-muted text-[10px] uppercase tracking-wide mt-1">
            {t.dashboard.charts.donutCenter}
          </span>
        </div>
      </div>
      <div className="flex items-center gap-4 mt-3 text-xs text-muted flex-wrap justify-center">
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-accent2 inline-block" />
          {t.dashboard.charts.deliveredLegend}: <span className="text-white font-semibold">{d}</span>{" "}
          <span className="text-accent2">({deliveredPct}%)</span>
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-danger inline-block" />
          {t.dashboard.charts.returnsLegend}: <span className="text-white font-semibold">{r}</span>{" "}
          <span className="text-danger">({returnsPct}%)</span>
        </span>
      </div>
    </div>
  );
}

// ---------- Линейный график: динамика посылок/возвратов по дням месяца ----------

export function TrendChart({ entries }) {
  const { t } = useLanguage();
  const sorted = [...entries].sort((a, b) => (a.id < b.id ? -1 : 1));

  if (sorted.length < 2) {
    return (
      <div className="text-muted text-sm py-10 text-center">{t.dashboard.charts.noData}</div>
    );
  }

  const W = 640;
  const H = 220;
  const padL = 34;
  const padR = 12;
  const padT = 16;
  const padB = 28;
  const innerW = W - padL - padR;
  const innerH = H - padT - padB;

  const maxVal = Math.max(1, ...sorted.map((e) => Math.max(Number(e.delivered) || 0, Number(e.returns) || 0)));
  const stepX = sorted.length > 1 ? innerW / (sorted.length - 1) : 0;

  function xAt(i) {
    return padL + i * stepX;
  }
  function yAt(v) {
    return padT + innerH - (v / maxVal) * innerH;
  }

  function pathFor(key) {
    return sorted
      .map((e, i) => `${i === 0 ? "M" : "L"}${xAt(i).toFixed(1)},${yAt(Number(e[key]) || 0).toFixed(1)}`)
      .join(" ");
  }

  // Показываем не более ~7 подписей по оси X, чтобы не наслаивались
  const labelEvery = Math.max(1, Math.ceil(sorted.length / 7));

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" role="img">
        {/* горизонтальные линии сетки */}
        {[0, 0.25, 0.5, 0.75, 1].map((f) => (
          <line
            key={f}
            x1={padL}
            x2={W - padR}
            y1={padT + innerH * (1 - f)}
            y2={padT + innerH * (1 - f)}
            stroke="#1f2937"
            strokeWidth="1"
          />
        ))}
        {/* подписи оси Y */}
        <text x={2} y={padT + 4} fill="#8b98a9" fontSize="9">
          {maxVal}
        </text>
        <text x={2} y={padT + innerH} fill="#8b98a9" fontSize="9">
          0
        </text>

        {/* линия возвратов (красная) под линией посылок */}
        <path d={pathFor("returns")} fill="none" stroke="#ef4444" strokeWidth="2" opacity="0.9" />
        {/* линия посылок (зелёная) */}
        <path d={pathFor("delivered")} fill="none" stroke="#22c55e" strokeWidth="2.5" />

        {sorted.map((e, i) => (
          <g key={e.id}>
            <circle cx={xAt(i)} cy={yAt(Number(e.delivered) || 0)} r="3" fill="#22c55e" />
            <circle cx={xAt(i)} cy={yAt(Number(e.returns) || 0)} r="2.5" fill="#ef4444" />
            {i % labelEvery === 0 && (
              <text x={xAt(i)} y={H - 8} fill="#8b98a9" fontSize="9" textAnchor="middle">
                {e.id.slice(8, 10)}
              </text>
            )}
          </g>
        ))}
      </svg>
      <div className="flex items-center gap-4 mt-2 text-xs text-muted">
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-accent2 inline-block" /> {t.dashboard.charts.deliveredLegend}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-danger inline-block" /> {t.dashboard.charts.returnsLegend}
        </span>
      </div>
    </div>
  );
}

// ---------- Столбчатый график: среднее по дням недели ----------

export function WeekdayBarChart({ buckets, metric, color, title }) {
  const { t, weekdaysMonFirst } = useLanguage();

  const active = buckets.filter((b) => b.days > 0);
  if (active.length < 2) {
    return (
      <div>
        <h4 className="text-white font-semibold text-sm mb-2">{title}</h4>
        <div className="text-muted text-sm py-6 text-center">{t.dashboard.charts.noData}</div>
      </div>
    );
  }

  const avgs = buckets.map((b) => (b.days > 0 ? b[metric] / b.days : 0));
  const maxAvg = Math.max(0.0001, ...avgs);

  let maxIdx = -1;
  let minIdx = -1;
  buckets.forEach((b, i) => {
    if (b.days === 0) return;
    if (maxIdx === -1 || avgs[i] > avgs[maxIdx]) maxIdx = i;
    if (minIdx === -1 || avgs[i] < avgs[minIdx]) minIdx = i;
  });

  const W = 320;
  const H = 180;
  const padB = 22;
  const padT = 10;
  const barGap = 10;
  const barW = (W - barGap * 8) / 7;

  return (
    <div>
      <h4 className="text-white font-semibold text-sm mb-2">{title}</h4>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" role="img">
        {buckets.map((b, i) => {
          const avg = avgs[i];
          const h = b.days > 0 ? (avg / maxAvg) * (H - padT - padB) : 0;
          const x = barGap + i * (barW + barGap);
          const y = H - padB - h;
          const isMax = i === maxIdx;
          const isMin = i === minIdx && minIdx !== maxIdx;
          const fill = isMax ? color.strong : isMin ? "#3a4658" : color.soft;
          return (
            <g key={b.dow}>
              <rect x={x} y={y} width={barW} height={Math.max(h, b.days > 0 ? 2 : 0)} rx="4" fill={fill} />
              {b.days > 0 && (
                <text x={x + barW / 2} y={y - 4} fill="#e5e7eb" fontSize="9" textAnchor="middle">
                  {avg >= 10 ? Math.round(avg) : avg.toFixed(1)}
                </text>
              )}
              <text x={x + barW / 2} y={H - 6} fill="#8b98a9" fontSize="9" textAnchor="middle">
                {weekdaysMonFirst[i]}
              </text>
            </g>
          );
        })}
      </svg>
      {maxIdx !== -1 && (
        <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1 text-xs">
          <span className="text-muted">
            {t.dashboard.charts.max}:{" "}
            <span className="text-white font-semibold">{weekdaysMonFirst[maxIdx]}</span>
          </span>
          {minIdx !== -1 && minIdx !== maxIdx && (
            <span className="text-muted">
              {t.dashboard.charts.min}:{" "}
              <span className="text-white font-semibold">{weekdaysMonFirst[minIdx]}</span>
            </span>
          )}
        </div>
      )}
    </div>
  );
}
