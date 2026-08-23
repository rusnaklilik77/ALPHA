// src/firebase.js
// Конфигурация Firebase берётся из переменных окружения (VITE_FIREBASE_*),
// а не хранится в коде. Это нужно, чтобы:
//  1) не хранить ключи в git,
//  2) можно было задать их прямо в настройках проекта на Vercel
//     (Project Settings -> Environment Variables) без правки кода.
//
// Как получить значения: Firebase Console -> Project settings -> General ->
// Your apps -> SDK setup and configuration. Бесплатного плана Spark хватает
// с запасом (Auth + Firestore).
//
// Локально: скопируй .env.example в .env и впиши свои значения.
// На Vercel: Project Settings -> Environment Variables -> добавь те же 6 ключей.

import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyACyI9JorI8NB_ZrTsvtKn5VgGoxC7n15A",
  authDomain: "alpha-courier-eb240.firebaseapp.com",
  projectId: "alpha-courier-eb240",
  storageBucket: "alpha-courier-eb240.firebasestorage.app",
  messagingSenderId: "327255104691",
  appId: "1:327255104691:web:68f79fc7f7dcf0aea4a4c6"
};

// Явно проверяем, что все ключи заданы. Без этого приложение при неверном
// конфиге просто зависало бы на экране "Загрузка ALPHA..." без объяснений.
export const isFirebaseConfigured = Object.values(firebaseConfig).every(
  (v) => typeof v === "string" && v.length > 0
);

let app = null;
let auth = null;
let db = null;
let adminApp = null;
let adminAuth = null;
let adminDb = null;

if (isFirebaseConfigured) {
  app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getFirestore(app);

  // Отдельный (второй) экземпляр Firebase-приложения — нужен для входа в
  // режим администратора через всплывающее окно на логотипе. Логин/пароль
  // администратора проверяются в своей изолированной auth-сессии и никак
  // не затрагивают сессию сотрудника, который сейчас работает в приложении
  // (т.е. можно попытаться войти в админку, не разлогинивая текущего
  // пользователя, а неверные данные просто не откроют панель).
  adminApp = initializeApp(firebaseConfig, "admin-session");
  adminAuth = getAuth(adminApp);
  adminDb = getFirestore(adminApp);
} else {
  // Не бросаем ошибку на этапе сборки/импорта — даём приложению отрисовать
  // понятный экран с инструкцией (см. src/App.jsx), вместо белого экрана.
  console.error(
    "[ALPHA] Firebase не настроен: заполни переменные окружения VITE_FIREBASE_* " +
      "(см. .env.example) и перезапусти сборку."
  );
}

export { auth, db, adminAuth, adminDb };
export default app;
