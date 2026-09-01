import { WEEKDAYS_FULL, MONTHS_GENITIVE, MONTHS_NOMINATIVE } from "../i18n/translations";

export function todayStr() {
  const d = new Date();
  return toDateStr(d);
}

export function toDateStr(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function firstDayOfMonthStr(d = new Date()) {
  return toDateStr(new Date(d.getFullYear(), d.getMonth(), 1));
}

// "YYYY-MM" ключ месяца по дате
export function monthKey(dateStr) {
  return dateStr.slice(0, 7);
}

export function currentMonthKey() {
  return monthKey(todayStr());
}

export function formatEuro(value) {
  const n = Number(value) || 0;
  return n.toLocaleString("de-DE", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function formatDateHuman(dateStr, lang = "ru") {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  const months = MONTHS_GENITIVE[lang] || MONTHS_GENITIVE.ru;
  const weekdays = WEEKDAYS_FULL[lang] || WEEKDAYS_FULL.ru;
  return `${d} ${months[m - 1]} ${y}, ${weekdays[dt.getDay()]}`;
}

export function formatDateShort(dateStr) {
  const [y, m, d] = dateStr.split("-").map(Number);
  return `${String(d).padStart(2, "0")}.${String(m).padStart(2, "0")}.${y}`;
}

// Название месяца-вкладки, например "Август 2026"
export function formatMonthLabel(key, lang = "ru") {
  const [y, m] = key.split("-").map(Number);
  const months = MONTHS_NOMINATIVE[lang] || MONTHS_NOMINATIVE.ru;
  return `${months[m - 1]} ${y}`;
}

// rateOverride — если передана текущая ставка пользователя, заработок
// всегда считается по НЕЙ (а не по ставке, сохранённой в самой записи).
// Так изменение ставки в настройках сразу пересчитывает все счётчики и
// графики «задним числом», как и просил пользователь. Если rateOverride
// не передан (undefined/null) — используется историческая ставка записи
// (нужно, например, для CSV-выгрузки, где важна точная ставка того дня).
export function entryEarnings(entry, rateOverride) {
  const delivered = Number(entry.delivered) || 0;
  const rate = rateOverride != null ? Number(rateOverride) || 0 : Number(entry.rate) || 0;
  const tips = Number(entry.tips) || 0;
  return delivered * rate + tips;
}

// Считает суммарные показатели по массиву записей
export function totals(entries, rateOverride) {
  return entries.reduce(
    (acc, e) => {
      acc.delivered += Number(e.delivered) || 0;
      acc.returns += Number(e.returns) || 0;
      acc.tips += Number(e.tips) || 0;
      acc.earnings += entryEarnings(e, rateOverride);
      acc.days += 1;
      return acc;
    },
    { delivered: 0, returns: 0, tips: 0, earnings: 0, days: 0 }
  );
}

// Лучший день по заработку среди набора записей (или null, если записей нет)
export function bestDay(entries, rateOverride) {
  if (!entries.length) return null;
  return entries.reduce(
    (best, e) => (entryEarnings(e, rateOverride) > entryEarnings(best, rateOverride) ? e : best),
    entries[0]
  );
}

// Сводка заработка по всем месяцам, отсортированная от новых к старым.
// Используется во всплывающем окне "Общий баланс".
export function monthlyBreakdown(entries, rateOverride) {
  const map = new Map();
  for (const e of entries) {
    const key = monthKey(e.id);
    if (!map.has(key)) {
      map.set(key, { key, delivered: 0, returns: 0, tips: 0, earnings: 0, days: 0 });
    }
    const bucket = map.get(key);
    bucket.delivered += Number(e.delivered) || 0;
    bucket.returns += Number(e.returns) || 0;
    bucket.tips += Number(e.tips) || 0;
    bucket.earnings += entryEarnings(e, rateOverride);
    bucket.days += 1;
  }
  return Array.from(map.values()).sort((a, b) => (a.key < b.key ? 1 : -1));
}

// Разбивает записи ВНУТРИ ОДНОГО месяца на недели (1-7, 8-14, 15-21, 22-28, 29-31)
// и считает показатели по каждой неделе. Так как считается прямо из живых
// entries, результат сам обновляется по ходу месяца — как только добавляется
// запись за очередную неделю, она сразу попадает в свой бакет и месячная
// картина складывается постепенно, неделя за неделей.
export function aggregateByWeek(entries, rateOverride) {
  const map = new Map();
  for (const e of entries) {
    const day = Number(e.id.slice(8, 10));
    const week = Math.ceil(day / 7);
    if (!map.has(week)) {
      map.set(week, { week, from: day, to: day, delivered: 0, returns: 0, tips: 0, earnings: 0, days: 0 });
    }
    const bucket = map.get(week);
    bucket.from = Math.min(bucket.from, day);
    bucket.to = Math.max(bucket.to, day);
    bucket.delivered += Number(e.delivered) || 0;
    bucket.returns += Number(e.returns) || 0;
    bucket.tips += Number(e.tips) || 0;
    bucket.earnings += entryEarnings(e, rateOverride);
    bucket.days += 1;
  }
  return Array.from(map.values()).sort((a, b) => a.week - b.week);
}

export function entriesThisMonth(entries) {
  const from = firstDayOfMonthStr();
  return entries.filter((e) => e.id >= from);
}

// Возвращает записи, относящиеся к конкретному месяцу "YYYY-MM"
export function entriesForMonth(entries, key) {
  return entries.filter((e) => monthKey(e.id) === key);
}

// Список всех месяцев, в которых есть записи (плюс текущий месяц всегда включён),
// отсортированный от новых к старым — так прошлые месяцы (например август) не теряются,
// а появляются отдельной вкладкой.
export function listMonths(entries) {
  const set = new Set(entries.map((e) => monthKey(e.id)));
  set.add(currentMonthKey());
  return Array.from(set).sort((a, b) => (a < b ? 1 : -1));
}

// Выгружает записи в CSV-файл и запускает скачивание в браузере.
export function exportEntriesToCSV(entries, { filename = "alpha-history.csv", headers, rateOverride } = {}) {
  const cols = headers || ["date", "delivered", "returns", "tips", "rate", "earnings"];
  const sorted = [...entries].sort((a, b) => (a.id < b.id ? -1 : 1));
  const lines = [cols.join(";")];
  for (const e of sorted) {
    lines.push(
      [
        e.id,
        Number(e.delivered) || 0,
        Number(e.returns) || 0,
        (Number(e.tips) || 0).toFixed(2),
        (rateOverride != null ? Number(rateOverride) : Number(e.rate)).toFixed(2),
        entryEarnings(e, rateOverride).toFixed(2),
      ].join(";")
    );
  }
  const blob = new Blob(["\uFEFF" + lines.join("\n")], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// Агрегирует посылки/возвраты по дню недели (0=Вс..6=Сб) для набора записей.
// Возвращает массив длиной 7, начиная с понедельника: [{ dow, delivered, returns, days }]
export function aggregateByWeekday(entries) {
  const buckets = Array.from({ length: 7 }, () => ({ delivered: 0, returns: 0, days: 0 }));
  for (const e of entries) {
    const [y, m, d] = e.id.split("-").map(Number);
    const dow = new Date(y, m - 1, d).getDay(); // 0 = Sunday
    buckets[dow].delivered += Number(e.delivered) || 0;
    buckets[dow].returns += Number(e.returns) || 0;
    buckets[dow].days += 1;
  }
  // Переставляем так, чтобы понедельник был первым
  const order = [1, 2, 3, 4, 5, 6, 0];
  return order.map((dow) => ({ dow, ...buckets[dow] }));
}
