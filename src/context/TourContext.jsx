import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { saveTour, subscribeTours, setTourFinish } from "../lib/data";
import { shouldAcceptPoint, routeDistance } from "../lib/geo";
import { todayStr } from "../lib/utils";

// Запись маршрута тура (GPS-трек).
//
// Провайдер живёт на уровне всего приложения (см. Gate в App.jsx), а не внутри
// окна «Доп. сведения» — поэтому запись продолжается, даже если окно закрыли
// или открыли режим администратора.
//
// Как это работает:
//  1) «Начать тур» -> берём первую точку и включаем navigator.geolocation.watchPosition.
//  2) Каждая принятая точка (см. shouldAcceptPoint) попадает в маршрут, а
//     копия маршрута сохраняется в localStorage — если вкладку случайно
//     перезагрузили, тур продолжится с того же места.
//  3) Раз в минуту маршрут отправляется в Firestore (status "active").
//  4) «Завершить тур» -> последняя точка, status "finished", а место
//     финиша дублируется в запись дня (tourFinish) — как в прошлой версии.
//
// Ограничение веба: обычная вкладка браузера не может писать GPS, когда экран
// выключен или приложение свёрнуто. Поэтому на время тура запрашиваем Screen
// Wake Lock (экран не гаснет). Полноценный фоновый трекинг возможен только в
// нативном приложении (см. README, раздел про APK).

const TourContext = createContext(null);

const FLUSH_EVERY_MS = 60 * 1000;
const STALE_TOUR_MS = 20 * 60 * 60 * 1000; // тур «висит» дольше 20 часов — закрываем сами
const lsKey = (uid) => `alpha_active_tour_${uid}`;

function readStored(uid) {
  try {
    const raw = localStorage.getItem(lsKey(uid));
    if (!raw) return null;
    const t = JSON.parse(raw);
    if (!t || !t.id || !Array.isArray(t.points)) return null;
    return t;
  } catch {
    return null;
  }
}

function writeStored(uid, tour) {
  try {
    if (tour) localStorage.setItem(lsKey(uid), JSON.stringify(tour));
    else localStorage.removeItem(lsKey(uid));
  } catch {
    // ignore (приватный режим / переполнение хранилища)
  }
}

// Код ошибки геолокации -> ключ строки в t.tour
function geoErrorKey(err) {
  if (!err) return "geoUnavailable";
  if (err.code === 1) return "geoDenied";
  if (err.code === 3) return "geoTimeout";
  return "geoUnavailable";
}

function getPosition(options) {
  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(resolve, reject, options);
  });
}

export function TourProvider({ uid, children }) {
  const [active, setActive] = useState(null); // текущий тур или null
  const [phase, setPhase] = useState("idle"); // idle | starting | finishing
  const [errorKey, setErrorKey] = useState("");
  const [tours, setTours] = useState([]);
  const [wakeLockOk, setWakeLockOk] = useState(true);
  const [justFinished, setJustFinished] = useState(null); // только что завершённый тур (чтобы показать карту)

  const activeRef = useRef(null);
  const watchIdRef = useRef(null);
  const lastFlushRef = useRef(0);
  const wakeLockRef = useRef(null);

  const setActiveBoth = useCallback((tour) => {
    activeRef.current = tour;
    setActive(tour);
  }, []);

  // ---- подписка на историю туров ----
  useEffect(() => {
    if (!uid) return;
    return subscribeTours(uid, setTours);
  }, [uid]);

  // ---- Screen Wake Lock ----
  const requestWakeLock = useCallback(async () => {
    try {
      if (!("wakeLock" in navigator)) {
        setWakeLockOk(false);
        return;
      }
      wakeLockRef.current = await navigator.wakeLock.request("screen");
      setWakeLockOk(true);
    } catch {
      setWakeLockOk(false);
    }
  }, []);

  const releaseWakeLock = useCallback(() => {
    try {
      wakeLockRef.current?.release();
    } catch {
      // ignore
    }
    wakeLockRef.current = null;
  }, []);

  // ---- сохранение в Firestore ----
  const flush = useCallback(
    async (tour, finished = false) => {
      if (!uid || !tour) return;
      await saveTour(uid, {
        id: tour.id,
        date: tour.date,
        startedAt: tour.startedAt,
        finishedAt: finished ? tour.finishedAt : null,
        status: finished ? "finished" : "active",
        points: tour.points,
        distanceM: tour.distanceM,
      });
      lastFlushRef.current = Date.now();
    },
    [uid]
  );

  // ---- новая GPS-точка от watchPosition ----
  const handlePosition = useCallback(
    (pos) => {
      const tour = activeRef.current;
      if (!tour) return;
      const { latitude, longitude, accuracy } = pos.coords;
      const tSec = Math.round((pos.timestamp || Date.now()) / 1000);
      const last = tour.points[tour.points.length - 1];
      const verdict = shouldAcceptPoint(last, latitude, longitude, accuracy, tSec);
      if (!verdict.ok) return;

      const next = {
        ...tour,
        points: [...tour.points, [latitude, longitude, tSec]],
        distanceM: tour.distanceM + verdict.dist,
        lastAccuracy: accuracy ?? null,
      };
      setActiveBoth(next);
      writeStored(uid, next);
      if (Date.now() - lastFlushRef.current >= FLUSH_EVERY_MS) {
        flush(next).catch(() => {});
      }
    },
    [uid, flush, setActiveBoth]
  );

  const beginWatch = useCallback(() => {
    if (watchIdRef.current != null || !navigator.geolocation) return;
    watchIdRef.current = navigator.geolocation.watchPosition(
      handlePosition,
      (err) => {
        // Временные ошибки (потеряли сигнал) игнорируем — watch продолжит
        // работать; про запрет доступа сообщаем человеку.
        if (err && err.code === 1) setErrorKey("geoDenied");
      },
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 30000 }
    );
  }, [handlePosition]);

  const endWatch = useCallback(() => {
    if (watchIdRef.current != null) {
      try {
        navigator.geolocation.clearWatch(watchIdRef.current);
      } catch {
        // ignore
      }
      watchIdRef.current = null;
    }
  }, []);

  // ---- восстановление тура после перезагрузки страницы ----
  useEffect(() => {
    if (!uid) return;
    const stored = readStored(uid);
    if (!stored) return;

    if (Date.now() - new Date(stored.startedAt).getTime() > STALE_TOUR_MS) {
      // Слишком старый «забытый» тур — закрываем его по последней точке.
      const last = stored.points[stored.points.length - 1];
      const closed = {
        ...stored,
        finishedAt: last ? new Date(last[2] * 1000).toISOString() : stored.startedAt,
      };
      flush(closed, true).catch(() => {});
      writeStored(uid, null);
      return;
    }

    setActiveBoth(stored);
    beginWatch();
    requestWakeLock();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid]);

  // Wake Lock сбрасывается, когда вкладка уходит в фон, — берём заново при возврате.
  useEffect(() => {
    function onVisible() {
      if (document.visibilityState === "visible" && activeRef.current) requestWakeLock();
    }
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [requestWakeLock]);

  // Выход из аккаунта / закрытие провайдера — останавливаем слежение (сам
  // тур остаётся в localStorage и продолжится при следующем входе).
  useEffect(() => {
    return () => {
      endWatch();
      releaseWakeLock();
    };
  }, [uid, endWatch, releaseWakeLock]);

  // ---- «Начать тур» ----
  const startTour = useCallback(async () => {
    if (activeRef.current || phase !== "idle") return;
    setErrorKey("");
    if (!navigator.geolocation) {
      setErrorKey("geoUnsupported");
      return;
    }
    setPhase("starting");
    try {
      const pos = await getPosition({ enableHighAccuracy: true, timeout: 20000, maximumAge: 0 });
      const now = Date.now();
      const tour = {
        id: `t${now}`,
        date: todayStr(),
        startedAt: new Date(now).toISOString(),
        points: [[pos.coords.latitude, pos.coords.longitude, Math.round(now / 1000)]],
        distanceM: 0,
        lastAccuracy: pos.coords.accuracy ?? null,
      };
      setJustFinished(null);
      setActiveBoth(tour);
      writeStored(uid, tour);
      beginWatch();
      requestWakeLock();
      flush(tour).catch(() => {});
    } catch (err) {
      setErrorKey(geoErrorKey(err));
    } finally {
      setPhase("idle");
    }
  }, [phase, uid, beginWatch, requestWakeLock, flush, setActiveBoth]);

  // ---- «Завершить тур» ----
  const finishTour = useCallback(async () => {
    const tour = activeRef.current;
    if (!tour || phase === "finishing") return;
    setErrorKey("");
    setPhase("finishing");
    endWatch();

    let points = tour.points;
    let distanceM = tour.distanceM;
    let lastAcc = tour.lastAccuracy ?? null;
    try {
      // Финишная точка: свежий замер, а если не получилось — последняя известная.
      const pos = await getPosition({ enableHighAccuracy: true, timeout: 8000, maximumAge: 10000 });
      const tSec = Math.round((pos.timestamp || Date.now()) / 1000);
      const last = points[points.length - 1];
      const moved = last ? routeDistance([last, [pos.coords.latitude, pos.coords.longitude, tSec]]) : 0;
      // Финиш добавляем всегда, даже если сдвиг маленький — он нужен как отдельная точка.
      if (!last || moved > 0.5) {
        points = [...points, [pos.coords.latitude, pos.coords.longitude, tSec]];
        distanceM += moved;
      }
      lastAcc = pos.coords.accuracy ?? lastAcc;
    } catch {
      // используем последнюю известную точку
    }

    const finished = {
      ...tour,
      points,
      distanceM,
      finishedAt: new Date().toISOString(),
    };
    try {
      await flush(finished, true);
      const end = points[points.length - 1];
      // Дублируем место финиша в запись дня — так отметка «Тур завершён» видна
      // в истории по дням и у администратора, как и раньше.
      await setTourFinish(uid, tour.date, { lat: end[0], lng: end[1], accuracy: lastAcc });
    } catch {
      // Ничего не потеряно: тур остаётся активным в localStorage, можно повторить.
      setErrorKey("saveError");
      beginWatch();
      setPhase("idle");
      return;
    }

    writeStored(uid, null);
    releaseWakeLock();
    setActiveBoth(null);
    setJustFinished(finished);
    setPhase("idle");
  }, [phase, uid, endWatch, beginWatch, flush, releaseWakeLock, setActiveBoth]);

  const value = {
    active,
    phase,
    errorKey,
    tours,
    wakeLockOk,
    justFinished,
    clearJustFinished: () => setJustFinished(null),
    startTour,
    finishTour,
  };

  return <TourContext.Provider value={value}>{children}</TourContext.Provider>;
}

export function useTour() {
  const ctx = useContext(TourContext);
  if (!ctx) throw new Error("useTour must be used within TourProvider");
  return ctx;
}
