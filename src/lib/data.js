import {
  doc,
  setDoc,
  getDoc,
  onSnapshot,
  collection,
  deleteDoc,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "../firebase";

export const DEFAULT_RATE = 0.7; // € за посылку по умолчанию

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
      callback(snap.data());
    } else {
      callback({ rate: DEFAULT_RATE, goal: 0 });
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

export async function upsertEntry(uid, dateStr, { delivered, returns, tips, rate }) {
  const ref = doc(db, "users", uid, "entries", entryId(dateStr));
  await setDoc(
    ref,
    {
      date: dateStr,
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
