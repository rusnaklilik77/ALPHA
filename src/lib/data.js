import {
  doc,
  setDoc,
  getDoc,
  getDocs,
  onSnapshot,
  collection,
  collectionGroup,
  query,
  where,
  orderBy,
  limit,
  deleteDoc,
  writeBatch,
  serverTimestamp,
  increment,
} from "firebase/firestore";
import { flattenPoints, thinPoints } from "./geo";
import { db } from "../firebase";

export const DEFAULT_RATE = 0.7; // € за посылку по умолчанию
export const DEFAULT_ROLE = "privat"; // privat | shop | driver | sorter

// Рабочие функции (роли) сотрудника:
//  privat — курьер приват: посылки × ставка за посылку + чаевые
//  shop   — курьер шоп: доход за месяц вводится вручную + чаевые
//  driver — водитель: ставка за ДЕНЬ, каждый день отмечает «отработал» (зелёная галочка)
//  sorter — сортировщик: ставка за ЧАС, вводит только отработанные часы
// Поле rate в документе пользователя означает «€ за посылку» / «€ за день» /
// «€ за час» в зависимости от роли.
export const ROLES = ["privat", "shop", "driver", "sorter"];

export function normalizeRole(role) {
  return ROLES.includes(role) ? role : DEFAULT_ROLE;
}

// Посылочные роли — те, у кого есть посылки, возвраты, чаевые и сканер.
export function isParcelRole(role) {
  return role === "privat" || role === "shop";
}

// Логин/пароль администратора проверяются локально, прямо в коде — без
// отдельного аккаунта в Firebase Auth. Это проще в настройке, но значит,
// что секрет лежит в исходниках приложения: поменяй пароль ниже на свой,
// и учти, что любой, кто увидит собранный код (например, через
// инструменты разработчика в браузере), сможет узнать пароль.
export const ADMIN_USERNAME = "admin";
const ADMIN_PASSWORD = "alpha007";

// ---------- Настройки пользователя (текущая ставка за посылку) ----------

// extra — дополнительные поля, которые нужно записать при первом создании
// документа (например { name, employeeId } сразу после регистрации).
export async function ensureUserDoc(uid, extra = {}) {
  const ref = doc(db, "users", uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    await setDoc(ref, {
      rate: DEFAULT_RATE,
      goal: 0,
      createdAt: serverTimestamp(),
      ...extra,
    });
  }
  return ref;
}

export function subscribeUserSettings(uid, callback) {
  const ref = doc(db, "users", uid);
  return onSnapshot(ref, (snap) => {
    if (snap.exists()) {
      callback({ role: DEFAULT_ROLE, ...snap.data() });
    } else {
      callback({ rate: DEFAULT_RATE, goal: 0, role: DEFAULT_ROLE });
    }
  });
}

export async function setUserRate(uid, rate) {
  const ref = doc(db, "users", uid);
  await setDoc(ref, { rate: Number(rate) }, { merge: true });
}

// ---------- Месячная цель по заработку (для полоски прогресса) ----------

export async function setUserGoal(uid, goal) {
  const ref = doc(db, "users", uid);
  await setDoc(ref, { goal: Number(goal) || 0 }, { merge: true });
}

// ---------- Записи по дням ----------
// id документа = YYYY-MM-DD, чтобы один день = одна запись

export function entryId(dateStr) {
  return dateStr; // уже в формате YYYY-MM-DD
}

export function subscribeEntries(uid, callback) {
  const colRef = collection(db, "users", uid, "entries");
  return onSnapshot(colRef, (snap) => {
    const entries = [];
    snap.forEach((d) => entries.push({ id: d.id, ...d.data() }));
    entries.sort((a, b) => (a.id < b.id ? 1 : -1)); // новые сверху
    callback(entries);
  });
}

export async function upsertEntry(uid, dateStr, { delivered, returns, tips, rate, totalParcels }) {
  const ref = doc(db, "users", uid, "entries", entryId(dateStr));
  await setDoc(
    ref,
    {
      date: dateStr,
      totalParcels: Number(totalParcels) || 0,
      delivered: Number(delivered) || 0,
      returns: Number(returns) || 0,
      tips: Number(tips) || 0,
      rate: Number(rate),
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
}

export async function deleteEntry(uid, dateStr) {
  const ref = doc(db, "users", uid, "entries", entryId(dateStr));
  await deleteDoc(ref);
}

// ---------- "Доп. сведения" — завершение тура с геометкой ----------
// Хранится прямо в записи за день (users/{uid}/entries/{dateStr}), поле
// tourFinish: { lat, lng, accuracy, finishedAt }. finishedAt — обычная ISO
// строка (Date().toISOString()), а не serverTimestamp(), потому что нам
// важно именно локальное время телефона сотрудника в момент завершения
// маршрута, а не время получения записи сервером.
export async function setTourFinish(uid, dateStr, { lat, lng, accuracy }) {
  const ref = doc(db, "users", uid, "entries", entryId(dateStr));
  const finishedAt = new Date().toISOString();
  await setDoc(
    ref,
    {
      date: dateStr,
      tourFinish: {
        lat: Number(lat),
        lng: Number(lng),
        accuracy: accuracy != null ? Number(accuracy) : null,
        finishedAt,
      },
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
  return finishedAt;
}

// Убирает отметку о завершении тура за день (если сотрудник нажал по ошибке).
export async function clearTourFinish(uid, dateStr) {
  const ref = doc(db, "users", uid, "entries", entryId(dateStr));
  await setDoc(ref, { tourFinish: null }, { merge: true });
}

// ---------- Доход за месяц для роли "Шоп" ----------
// У курьеров на шопе нет ставки за посылку — они просто вводят сумму,
// которую фактически получили за месяц (например, из ведомости). Хранится
// отдельно от entries, по одному документу на месяц: users/{uid}/monthlyPay/{YYYY-MM}.

export async function setMonthlyPay(uid, monthKey, amount) {
  const ref = doc(db, "users", uid, "monthlyPay", monthKey);
  await setDoc(
    ref,
    { amount: Number(amount) || 0, updatedAt: serverTimestamp() },
    { merge: true }
  );
}

// callback получает объект вида { "2026-09": 850, "2026-08": 900, ... }
export function subscribeMonthlyPay(uid, callback) {
  if (!uid) return () => {};
  const colRef = collection(db, "users", uid, "monthlyPay");
  return onSnapshot(
    colRef,
    (snap) => {
      const map = {};
      snap.forEach((d) => {
        map[d.id] = Number(d.data().amount) || 0;
      });
      callback(map);
    },
    () => callback({})
  );
}

// ---------- Режим администратора ----------
// Логин и пароль сверяются прямо здесь, без обращения к Firebase — если
// совпали, окно входа просто закрывается и открывается панель. Сессия
// текущего сотрудника (его вход по email/паролю) при этом никак не
// затрагивается.
export async function adminLogin(login, password) {
  if (
    String(login || "").trim().toLowerCase() !== ADMIN_USERNAME ||
    password !== ADMIN_PASSWORD
  ) {
    const err = new Error("invalid-login");
    err.code = "invalid-login";
    throw err;
  }
  return true;
}

export function adminLogout() {
  return Promise.resolve();
}

// Список сотрудников и их записи читаются через сессию уже вошедшего в
// приложение сотрудника (db, та же, что и everywhere else), а не через
// отдельный admin-аккаунт. Чтобы это сработало, правило isAdmin() в
// firestore.rules разрешает читать чужие документы любому вошедшему в
// приложение пользователю — реальным «замком» служит окно с паролем выше,
// а не Firestore (см. подробности в firestore.rules).
export function subscribeAllUsersAdmin(callback) {
  const colRef = collection(db, "users");
  return onSnapshot(
    colRef,
    (snap) => {
      const list = [];
      snap.forEach((d) => list.push({ uid: d.id, ...d.data() }));
      list.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
      callback(list);
    },
    () => callback([])
  );
}

export function subscribeEntriesAdmin(uid, callback) {
  const colRef = collection(db, "users", uid, "entries");
  return onSnapshot(colRef, (snap) => {
    const entries = [];
    snap.forEach((d) => entries.push({ id: d.id, ...d.data() }));
    entries.sort((a, b) => (a.id < b.id ? 1 : -1));
    callback(entries);
  });
}

// ---------- Общий рейтинг сотрудников за месяц (режим администратора) ----------
// Одним запросом (collectionGroup по подколлекциям "entries" ВСЕХ пользователей)
// забираем все записи за нужный месяц и суммируем показатели по владельцу
// документа (uid родителя). Так рейтинг не нужно пересчитывать вручную —
// как только у сотрудника появляется новая запись за день, счётчик в
// рейтинге обновляется сам, а новые сотрудники подтягиваются автоматически,
// как только у них появляется хотя бы одна запись (через subscribeAllUsersAdmin).
// onError — необязательный колбэк, получающий исходную ошибку Firestore.
// Раньше при ошибке запроса (например, ещё не создан нужный collection-group
// индекс в Firestore — см. README, раздел "Индекс для рейтинга") рейтинг
// молча показывал всем по 0 посылок, и было не понять, реальная это цифра
// или сломанный запрос. Теперь ошибка дополнительно логируется в консоль и
// пробрасывается наверх, чтобы интерфейс мог показать понятное сообщение.
export function subscribeMonthStatsAllUsers(monthKey, callback, onError) {
  const from = `${monthKey}-01`;
  const to = `${monthKey}-31`;
  const q = query(
    collectionGroup(db, "entries"),
    where("date", ">=", from),
    where("date", "<=", to)
  );
  return onSnapshot(
    q,
    (snap) => {
      const byUid = new Map();
      snap.forEach((d) => {
        const uid = d.ref.parent.parent?.id;
        if (!uid) return;
        const data = d.data();
        if (!byUid.has(uid)) {
          byUid.set(uid, { delivered: 0, returns: 0, tips: 0, totalParcels: 0, days: 0, hours: 0, worked: 0 });
        }
        const b = byUid.get(uid);
        b.delivered += Number(data.delivered) || 0;
        b.returns += Number(data.returns) || 0;
        b.tips += Number(data.tips) || 0;
        b.totalParcels += Number(data.totalParcels) || 0;
        b.hours += Number(data.hours) || 0;
        if (data.worked === true) b.worked += 1;
        b.days += 1;
      });
      callback(byUid);
    },
    (err) => {
      console.error("[ALPHA] subscribeMonthStatsAllUsers:", err);
      if (onError) onError(err);
      callback(new Map());
    }
  );
}

// ---------- Сканер посылок (QR-код + физический сканер штрихкодов) ----------
// Идея: у каждого сотрудника есть секретный "scanToken" в его документе
// users/{uid}. QR-код в приложении кодирует ссылку вида
// "<сайт>?scan=<uid>&t=<token>". Открыв эту ссылку на телефоне или
// устройстве со сканером штрихкодов, сотрудник попадает на отдельную
// страницу-компаньон (ScanPage), которая может добавлять +1 к
// доставленным/возвратам за сегодня БЕЗ полноценного входа по
// email/паролю — доступ и запись разрешены только тому, кто знает
// правильную пару uid+token (см. firestore.rules). Смена ("Обновить код")
// мгновенно делает старый QR нерабочим.

export function generateScanToken() {
  const bytes = new Uint8Array(16);
  (window.crypto || window.msCrypto).getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

// Возвращает текущий scanToken пользователя, создавая новый, если его ещё нет.
export async function ensureScanToken(uid, existingToken) {
  if (existingToken) return existingToken;
  const token = generateScanToken();
  await setDoc(doc(db, "users", uid), { scanToken: token }, { merge: true });
  return token;
}

// Полностью заменяет токен — старый QR-код перестаёт работать.
export async function regenerateScanToken(uid) {
  const token = generateScanToken();
  await setDoc(doc(db, "users", uid), { scanToken: token }, { merge: true });
  return token;
}

// Читает публично доступную часть документа сотрудника по uid — используется
// страницей сканера (ScanPage), где пользователь ещё не вошёл в систему.
// Разрешено правилами Firestore только для документов, у которых уже
// установлен scanToken (см. firestore.rules).
export async function fetchScanUser(uid) {
  const ref = doc(db, "users", uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  return { uid, ...snap.data() };
}

// Добавляет +1 к полю "delivered" или "returns" в записи за сегодняшний
// день, используя атомарный increment() — так странице сканера не нужно
// сначала читать текущее значение. Поле scanToken пишется вместе с
// остальными данными и служит доказательством для правила Firestore, что
// запрос пришёл от владельца верного QR-кода (см. firestore.rules).
export async function scanIncrement(uid, token, dateStr, field, rate) {
  const ref = doc(db, "users", uid, "entries", dateStr);
  await setDoc(
    ref,
    {
      date: dateStr,
      [field]: increment(1),
      rate: Number(rate) || DEFAULT_RATE,
      scanToken: token,
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
}

// ---------- Профиль сотрудника (настройки: имя, ID, телефон) ----------
// Email хранится только в Firebase Auth и здесь не меняется (для смены email
// Firebase требует повторного входа), поэтому в настройках он только показывается.
export async function setUserProfile(uid, { name, employeeId, phone }) {
  const ref = doc(db, "users", uid);
  await setDoc(
    ref,
    {
      name: String(name ?? "").trim(),
      employeeId: String(employeeId ?? "").trim(),
      phone: String(phone ?? "").trim(),
    },
    { merge: true }
  );
}

// Простая проверка телефона: допускаем +, цифры, пробелы, скобки и дефисы,
// но самих цифр должно быть от 6 до 15 (международный формат E.164).
export function isValidPhone(value) {
  const v = String(value || "").trim();
  if (!/^[+0-9()\s\-.]+$/.test(v)) return false;
  const digits = v.replace(/\D/g, "");
  return digits.length >= 6 && digits.length <= 15;
}

// ---------- Водитель: отметка «день отработан» ----------
// Одна запись на день (id = YYYY-MM-DD), как и у остальных ролей. worked=true —
// день засчитан. Ставка (€/день) в записи — историческая, для CSV; на экране
// заработок считается по актуальной ставке из настроек (как и у остальных).
export async function setDriverWorked(uid, dateStr, rate) {
  const ref = doc(db, "users", uid, "entries", entryId(dateStr));
  await setDoc(
    ref,
    {
      date: dateStr,
      worked: true,
      rate: Number(rate) || 0,
      delivered: 0,
      returns: 0,
      tips: 0,
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
}

// Снимает отметку. Если в записи есть данные тура (tourFinish) — запись не
// удаляем, а просто ставим worked=false, иначе удаляем целиком.
export async function unsetDriverWorked(uid, dateStr, keepDoc = false) {
  const ref = doc(db, "users", uid, "entries", entryId(dateStr));
  if (keepDoc) {
    await setDoc(ref, { worked: false, updatedAt: serverTimestamp() }, { merge: true });
  } else {
    await deleteDoc(ref);
  }
}

// ---------- Сортировщик: часы работы за день ----------
export async function upsertSorterEntry(uid, dateStr, { hours, rate }) {
  const ref = doc(db, "users", uid, "entries", entryId(dateStr));
  await setDoc(
    ref,
    {
      date: dateStr,
      hours: Number(hours) || 0,
      rate: Number(rate) || 0,
      delivered: 0,
      returns: 0,
      tips: 0,
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
}

// ---------- Туры: запись маршрута (GPS-трек) ----------
// users/{uid}/tours/{tourId}:
//   { date, startedAt (ISO), finishedAt (ISO | null), status: "active" | "finished",
//     pts: [lat,lng,t, lat,lng,t, ...] (см. lib/geo.js), distanceM, updatedAt }
// Пока тур идёт, приложение периодически перезаписывает документ (status
// "active"), поэтому маршрут не теряется, если телефон разрядился, и админ
// может посмотреть его почти вживую.
export async function saveTour(uid, tour) {
  const ref = doc(db, "users", uid, "tours", tour.id);
  await setDoc(
    ref,
    {
      date: tour.date,
      startedAt: tour.startedAt,
      finishedAt: tour.finishedAt || null,
      status: tour.status,
      pts: flattenPoints(thinPoints(tour.points)),
      distanceM: Math.round(Number(tour.distanceM) || 0),
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
}

export function subscribeTours(uid, callback) {
  if (!uid) return () => {};
  const q = query(collection(db, "users", uid, "tours"), orderBy("startedAt", "desc"), limit(30));
  return onSnapshot(
    q,
    (snap) => {
      const list = [];
      snap.forEach((d) => list.push({ id: d.id, ...d.data() }));
      callback(list);
    },
    (err) => {
      console.error("[ALPHA] subscribeTours:", err);
      callback([]);
    }
  );
}

export async function deleteTour(uid, tourId) {
  await deleteDoc(doc(db, "users", uid, "tours", tourId));
}

// ---------- SOS ----------
// Кому слать SOS, сотрудник выбирает ЗАРАНЕЕ (Доп. сведения → SOS): либо
// «всем зарегистрированным» (sosAll), либо отдельных людей (sosContacts —
// массив uid). Нажатие красной кнопки SOS кладёт документ-сигнал в «почтовый
// ящик» каждого получателя: users/{получатель}/sosInbox/{uid отправителя}.
// Приложение получателя слушает свой ящик в реальном времени и сразу
// показывает всплывающее окно на весь экран (см. components/SosReceiver.jsx).
// Документ = uid отправителя, поэтому повторное нажатие не плодит дубли, а
// «Отменить SOS» просто удаляет эти документы.

export async function setSosContacts(uid, { all, contacts }) {
  await setDoc(
    doc(db, "users", uid),
    { sosAll: !!all, sosContacts: Array.isArray(contacts) ? contacts : [] },
    { merge: true }
  );
}

// Все зарегистрированные пользователи (для выбора получателей SOS).
export function subscribeAllUsers(callback) {
  return subscribeAllUsersAdmin(callback);
}

export async function fetchAllUserUids() {
  const snap = await getDocs(collection(db, "users"));
  const uids = [];
  snap.forEach((d) => uids.push(d.id));
  return uids;
}

// Firestore ограничивает один batch 500 операциями — режем на куски.
async function runInChunks(items, size, fn) {
  for (let i = 0; i < items.length; i += size) {
    const batch = writeBatch(db);
    for (const item of items.slice(i, i + size)) fn(batch, item);
    await batch.commit();
  }
}

export async function sendSos(uid, sender, targets, location) {
  const uniqueTargets = Array.from(new Set(targets)).filter((x) => x && x !== uid);
  const payload = {
    fromUid: uid,
    fromName: sender.name || "",
    fromPhone: sender.phone || "",
    fromEmployeeId: sender.employeeId || "",
    lat: location?.lat ?? null,
    lng: location?.lng ?? null,
    accuracy: location?.accuracy ?? null,
    sentAt: Date.now(),
    active: true,
  };
  await runInChunks(uniqueTargets, 400, (batch, target) => {
    batch.set(doc(db, "users", target, "sosInbox", uid), payload);
  });
  await setDoc(
    doc(db, "users", uid),
    { sosActive: { targets: uniqueTargets, sentAt: payload.sentAt } },
    { merge: true }
  );
  return { sent: uniqueTargets.length, sentAt: payload.sentAt };
}

export async function cancelSos(uid, targets = []) {
  await runInChunks(targets, 400, (batch, target) => {
    batch.delete(doc(db, "users", target, "sosInbox", uid));
  });
  await setDoc(doc(db, "users", uid), { sosActive: null }, { merge: true });
}

export function subscribeSosInbox(uid, callback) {
  if (!uid) return () => {};
  return onSnapshot(
    collection(db, "users", uid, "sosInbox"),
    (snap) => {
      const list = [];
      snap.forEach((d) => list.push({ id: d.id, ...d.data() }));
      callback(list);
    },
    (err) => {
      console.error("[ALPHA] subscribeSosInbox:", err);
      callback([]);
    }
  );
}

export async function dismissSos(uid, fromUid) {
  await deleteDoc(doc(db, "users", uid, "sosInbox", fromUid));
}
