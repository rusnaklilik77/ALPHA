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

// Первый месяц, за который в компании вообще есть работа/статистика.
// Рейтинг (и его вкладки месяцев) никогда не показывает месяцы раньше этого —
// поэтому апрель/май/июнь/июль 2026 в списке не появляются, их просто не было.
export const WORK_START_MONTH = "2026-08";

// Список месяцев от WORK_START_MONTH до текущего месяца включительно (новые
// первыми). Список считается от today() при каждом вызове, поэтому 1-го
// числа каждого нового месяца в рейтинге сама по себе появляется новая
// вкладка — руками ничего добавлять не нужно, и старые "несуществующие"
// месяцы до начала работы никогда не всплывают.
export function monthsSinceStart(startKey = WORK_START_MONTH) {
  const nowKey = currentMonthKey();
  if (nowKey < startKey) return [nowKey];

  const [startY, startM] = startKey.split("-").map(Number);
  const [nowY, nowM] = nowKey.split("-").map(Number);
  const out = [];
  let y = nowY;
  let m = nowM;
  let guard = 0; // защита от бесконечного цикла при некорректных датах
  while ((y > startY || (y === startY && m >= startM)) && guard < 600) {
    out.push(`${y}-${String(m).padStart(2, "0")}`);
    m -= 1;
    if (m === 0) {
      m = 12;
      y -= 1;
    }
    guard += 1;
  }
  return out;
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

// Роль влияет на то, как считается заработок за запись (день):
//   privat / shop — отдано посылок × ставка (+ чаевые отдельно)
//   driver        — ставка за день, если день отмечен как «отработан»
//   sorter        — отработанные часы × ставка за час
// Везде ниже role — необязательный последний аргумент (по умолчанию "privat"),
// поэтому старые вызовы без роли работают как раньше.
//
// rateOverride — если передана текущая ставка пользователя, заработок
// всегда считается по НЕЙ (а не по ставке, сохранённой в самой записи).
// Так изменение ставки в настройках сразу пересчитывает все счётчики и
// графики «задним числом», как и просил пользователь. Если rateOverride
// не передан (undefined/null) — используется историческая ставка записи
// (нужно, например, для CSV-выгрузки, где важна точная ставка того дня).
//
// Доход (без чаевых) — намеренно ОТДЕЛЬНАЯ функция от entryEarnings ниже.
// Чаевые — деньги от клиента, а не от работодателя, и по просьбе
// пользователя они нигде не должны "сливаться" с основным заработком:
// везде, где считается основной доход (заголовок дашборда, карточки
// "Всего", "Общий баланс", режим администратора), используется именно
// entryIncome, а чаевые показываются отдельным счётчиком рядом.
export function entryIncome(entry, rateOverride, role = "privat") {
  const rate = rateOverride != null ? Number(rateOverride) || 0 : Number(entry.rate) || 0;
  if (role === "driver") return entry.worked === true ? rate : 0;
  if (role === "sorter") return (Number(entry.hours) || 0) * rate;
  return (Number(entry.delivered) || 0) * rate;
}

// Доход + чаевые вместе — используется только там, где осознанно нужна
// ИТОГОВАЯ сумма на руки за день (колонка "Заработок" в истории по дням или
// сравнение "лучшего дня"). Чаевые бывают только у посылочных ролей.
export function entryEarnings(entry, rateOverride, role = "privat") {
  const tips = role === "driver" || role === "sorter" ? 0 : Number(entry.tips) || 0;
  return entryIncome(entry, rateOverride, role) + tips;
}

// Считается ли запись рабочим днём. У посылочных ролей любая запись — это
// день (как и раньше). У водителя — только с отметкой "отработал", у
// сортировщика — только если введены часы.
export function isWorkDay(entry, role = "privat") {
  if (role === "driver") return entry.worked === true;
  if (role === "sorter") return (Number(entry.hours) || 0) > 0;
  return true;
}

// Считает суммарные показатели по массиву записей
export function totals(entries, rateOverride, role = "privat") {
  return entries.reduce(
    (acc, e) => {
      acc.delivered += Number(e.delivered) || 0;
      acc.returns += Number(e.returns) || 0;
      acc.tips += Number(e.tips) || 0;
      acc.hours += role === "sorter" ? Number(e.hours) || 0 : 0;
      acc.income += entryIncome(e, rateOverride, role);
      acc.earnings += entryEarnings(e, rateOverride, role);
      if (isWorkDay(e, role)) acc.days += 1;
      return acc;
    },
    { delivered: 0, returns: 0, tips: 0, hours: 0, income: 0, earnings: 0, days: 0 }
  );
}

// Лучший день по заработку среди набора записей (или null, если записей нет)
export function bestDay(entries, rateOverride, role = "privat") {
  const days = entries.filter((e) => isWorkDay(e, role));
  if (!days.length) return null;
  return days.reduce(
    (best, e) =>
      entryEarnings(e, rateOverride, role) > entryEarnings(best, rateOverride, role) ? e : best,
    days[0]
  );
}

// Сводка заработка по всем месяцам, отсортированная от новых к старым.
// Используется во всплывающем окне "Общий баланс".
export function monthlyBreakdown(entries, rateOverride, role = "privat") {
  const map = new Map();
  for (const e of entries) {
    const key = monthKey(e.id);
    if (!map.has(key)) {
      map.set(key, { key, delivered: 0, returns: 0, tips: 0, hours: 0, income: 0, earnings: 0, days: 0 });
    }
    const bucket = map.get(key);
    bucket.delivered += Number(e.delivered) || 0;
    bucket.returns += Number(e.returns) || 0;
    bucket.tips += Number(e.tips) || 0;
    bucket.hours += role === "sorter" ? Number(e.hours) || 0 : 0;
    bucket.income += entryIncome(e, rateOverride, role);
    bucket.earnings += entryEarnings(e, rateOverride, role);
    if (isWorkDay(e, role)) bucket.days += 1;
  }
  return Array.from(map.values()).sort((a, b) => (a.key < b.key ? 1 : -1));
}

// Разбивает записи ВНУТРИ ОДНОГО месяца на недели (1-7, 8-14, 15-21, 22-28, 29-31)
// и считает показатели по каждой неделе. Так как считается прямо из живых
// entries, результат сам обновляется по ходу месяца — как только добавляется
// запись за очередную неделю, она сразу попадает в свой бакет и месячная
// картина складывается постепенно, неделя за неделей.
export function aggregateByWeek(entries, rateOverride, role = "privat") {
  const map = new Map();
  for (const e of entries) {
    if (!isWorkDay(e, role)) continue;
    const day = Number(e.id.slice(8, 10));
    const week = Math.ceil(day / 7);
    if (!map.has(week)) {
      map.set(week, { week, from: day, to: day, delivered: 0, returns: 0, tips: 0, hours: 0, income: 0, earnings: 0, days: 0 });
    }
    const bucket = map.get(week);
    bucket.from = Math.min(bucket.from, day);
    bucket.to = Math.max(bucket.to, day);
    bucket.delivered += Number(e.delivered) || 0;
    bucket.returns += Number(e.returns) || 0;
    bucket.tips += Number(e.tips) || 0;
    bucket.hours += role === "sorter" ? Number(e.hours) || 0 : 0;
    bucket.income += entryIncome(e, rateOverride, role);
    bucket.earnings += entryEarnings(e, rateOverride, role);
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
export function exportEntriesToCSV(entries, { filename = "alpha-history.csv", headers, rateOverride, role = "privat" } = {}) {
  // "income" (заработок без чаевых) и "tips" (чаевые) идут отдельными колонками —
  // чтобы в выгрузке они тоже не сливались в одну сумму, "total" — это уже
  // просто их сумма, для удобства сверки.
  const defaults = {
    privat: ["date", "delivered", "returns", "income", "tips", "rate", "total"],
    shop: ["date", "delivered", "returns", "income", "tips", "rate", "total"],
    driver: ["date", "worked", "income", "rate", "total"],
    sorter: ["date", "hours", "income", "rate", "total"],
  };
  const cols = headers || defaults[role] || defaults.privat;
  const sorted = [...entries]
    .filter((e) => isWorkDay(e, role) || role === "privat" || role === "shop")
    .sort((a, b) => (a.id < b.id ? -1 : 1));
  const rateOf = (e) => (rateOverride != null ? Number(rateOverride) : Number(e.rate) || 0).toFixed(2);
  const lines = [cols.join(";")];
  for (const e of sorted) {
    const income = entryIncome(e, rateOverride, role).toFixed(2);
    const total = entryEarnings(e, rateOverride, role).toFixed(2);
    let row;
    if (role === "driver") {
      row = [e.id, e.worked === true ? 1 : 0, income, rateOf(e), total];
    } else if (role === "sorter") {
      row = [e.id, (Number(e.hours) || 0).toFixed(2), income, rateOf(e), total];
    } else {
      row = [
        e.id,
        Number(e.delivered) || 0,
        Number(e.returns) || 0,
        income,
        (Number(e.tips) || 0).toFixed(2),
        rateOf(e),
        total,
      ];
    }
    lines.push(row.join(";"));
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

// Ссылка на Google Maps по координатам — используется, чтобы показать, где
// сотрудник завершил маршрут (см. функцию "Доп. сведения" / завершение тура).
export function mapsLink(lat, lng) {
  return `https://www.google.com/maps?q=${lat},${lng}`;
}

// Короткое время из ISO-строки, например "18:42"
export function formatTimeShort(isoStr) {
  if (!isoStr) return "";
  const d = new Date(isoStr);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });
}

// Агрегирует посылки/возвраты по дню недели (0=Вс..6=Сб) для набора записей.
// Возвращает массив длиной 7, начиная с понедельника: [{ dow, delivered, returns, days }]
export function aggregateByWeekday(entries) {
  const buckets = Array.from({ length: 7 }, () => ({ delivered: 0, returns: 0, tips: 0, hours: 0, days: 0 }));
  for (const e of entries) {
    const [y, m, d] = e.id.split("-").map(Number);
    const dow = new Date(y, m - 1, d).getDay(); // 0 = Sunday
    buckets[dow].delivered += Number(e.delivered) || 0;
    buckets[dow].returns += Number(e.returns) || 0;
    buckets[dow].tips += Number(e.tips) || 0;
    buckets[dow].hours += Number(e.hours) || 0;
    buckets[dow].days += 1;
  }
  // Переставляем так, чтобы понедельник был первым
  const order = [1, 2, 3, 4, 5, 6, 0];
  return order.map((dow) => ({ dow, ...buckets[dow] }));
}

// Часы в удобном виде: 8 -> "8", 7.5 -> "7.5", 7.25 -> "7.25"
export function formatHours(value) {
  const n = Number(value) || 0;
  return String(Math.round(n * 100) / 100);
}

// Календарь месяца для водителя: массив недель, начиная с понедельника.
// Пустые ячейки в начале/конце — null, остальные — строка "YYYY-MM-DD".
export function buildMonthGrid(key) {
  const [y, m] = key.split("-").map(Number);
  const daysInMonth = new Date(y, m, 0).getDate();
  const firstDow = (new Date(y, m - 1, 1).getDay() + 6) % 7; // 0 = понедельник
  const cells = [];
  for (let i = 0; i < firstDow; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push(`${key}-${String(d).padStart(2, "0")}`);
  }
  while (cells.length % 7 !== 0) cells.push(null);
  const weeks = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}
