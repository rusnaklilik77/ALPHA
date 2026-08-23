// valueColor — явный класс цвета цифры: "text-white" (деньги), "text-accent2" (зелёный, посылки),
// "text-danger" (красный, возвраты), "text-accent" (аква, для прочих метрик)
export default function StatCard({ label, value, sub, valueColor = "text-white", icon }) {
  return (
    <div className="bg-panel border border-border rounded-xl2 shadow-card p-5 flex flex-col gap-2 min-w-0">
      <div className="flex items-center justify-between">
        <span className="text-muted text-xs font-medium uppercase tracking-wide">{label}</span>
        {icon && <span className="text-lg opacity-80">{icon}</span>}
      </div>
      <div className={`text-2xl sm:text-3xl font-extrabold tracking-tight truncate ${valueColor}`}>
        {value}
      </div>
      {sub && <span className="text-muted text-xs">{sub}</span>}
    </div>
  );
}
