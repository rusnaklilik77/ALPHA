import {
  doc,
  setDoc,
  getDoc,
  onSnapshot,
  collection,
  collectionGroup,
  query,
  where,
  deleteDoc,
  serverTimestamp,
  increment,
} from "firebase/firestore";
import { db } from "../firebase";

export const DEFAULT_RATE = 0.7; // € за посылку по умолчанию
export const DEFAULT_ROLE = "privat"; // privat | shop

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
          byUid.set(uid, { delivered: 0, returns: 0, tips: 0, totalParcels: 0, days: 0 });
        }
        const b = byUid.get(uid);
        b.delivered += Number(data.delivered) || 0;
        b.returns += Number(data.returns) || 0;
        b.tips += Number(data.tips) || 0;
        b.totalParcels += Number(data.totalParcels) || 0;
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
