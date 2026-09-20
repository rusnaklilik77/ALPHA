import { createContext, useContext, useEffect, useRef, useState } from "react";
import {
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
} from "firebase/auth";
import { auth } from "../firebase";
import { ensureUserDoc, normalizeRole, DEFAULT_RATE } from "../lib/data";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  // Пока идёт регистрация, не «впускаем» нового пользователя в приложение
  // сразу после создания аккаунта: иначе Dashboard успевал создать
  // документ users/{uid} со значениями по умолчанию (роль «приват», ставка
  // 0.70) раньше, чем register() записывал выбранную роль, телефон и т.д.
  const registeringRef = useRef(false);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      if (registeringRef.current) return;
      setUser(u);
      setLoading(false);
    });
    return unsub;
  }, []);

  async function register(name, email, password, employeeId, role, phone) {
    registeringRef.current = true;
    try {
      return await doRegister(name, email, password, employeeId, role, phone);
    } finally {
      registeringRef.current = false;
      setUser(auth.currentUser);
      setLoading(false);
    }
  }

  async function doRegister(name, email, password, employeeId, role, phone) {
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    if (name) {
      await updateProfile(cred.user, { displayName: name });
    }
    // Имя, идентификационный номер, телефон и функция на работе (курьер
    // приват / курьер шоп / водитель / сортировщик) сохраняются ещё и в
    // Firestore (не только в профиле Auth), потому что список сотрудников в
    // режиме админа и выбор получателей SOS строятся из документов users/* —
    // профиль Auth других людей клиенту недоступен.
    const finalRole = normalizeRole(role);
    await ensureUserDoc(cred.user.uid, {
      name: name || "",
      employeeId: (employeeId || "").trim(),
      phone: (phone || "").trim(),
      role: finalRole,
      // У водителя ставка — €/день, у сортировщика — €/час: своей «типовой»
      // цифры нет, стартуем с 0, и человек сам вписывает, сколько ему платят.
      rate: finalRole === "driver" || finalRole === "sorter" ? 0 : DEFAULT_RATE,
    });
    return cred.user;
  }

  function login(email, password) {
    return signInWithEmailAndPassword(auth, email, password);
  }

  function logout() {
    return signOut(auth);
  }

  const value = { user, loading, register, login, logout };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
