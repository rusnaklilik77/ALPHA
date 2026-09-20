// Вспомогательные функции для записи маршрута тура.
//
// Формат хранения точек — ПЛОСКИЙ массив чисел [lat, lng, t, lat, lng, t, ...],
// где t — время точки в секундах Unix. Так сделано потому, что Firestore не
// умеет хранить массивы внутри массивов ([[lat,lng],[lat,lng]] — нельзя), а
// массив объектов {lat,lng,t} занимал бы в несколько раз больше места.

const EARTH_RADIUS_M = 6371000;

function toRad(deg) {
  return (deg * Math.PI) / 180;
}

// Расстояние между двумя точками на Земле (формула гаверсинуса), в метрах.
export function haversine(lat1, lng1, lat2, lng2) {
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(a)));
}

// [[lat,lng,t], ...] -> [lat,lng,t,lat,lng,t,...]
export function flattenPoints(points) {
  const out = [];
  for (const p of points) {
    out.push(Number(p[0].toFixed(6)), Number(p[1].toFixed(6)), Math.round(p[2]));
  }
  return out;
}

// [lat,lng,t,lat,lng,t,...] -> [[lat,lng,t], ...]
export function unflattenPoints(flat) {
  const out = [];
  if (!Array.isArray(flat)) return out;
  for (let i = 0; i + 2 < flat.length; i += 3) {
    out.push([Number(flat[i]), Number(flat[i + 1]), Number(flat[i + 2])]);
  }
  return out;
}

// Общая длина маршрута в метрах.
export function routeDistance(points) {
  let total = 0;
  for (let i = 1; i < points.length; i++) {
    total += haversine(points[i - 1][0], points[i - 1][1], points[i][0], points[i][1]);
  }
  return total;
}

// Если точек слишком много (документ Firestore ограничен ~1 МБ), равномерно
// прореживаем маршрут, но всегда сохраняем первую и последнюю точки.
export const MAX_SAVED_POINTS = 8000;

export function thinPoints(points, max = MAX_SAVED_POINTS) {
  if (points.length <= max) return points;
  const step = (points.length - 1) / (max - 1);
  const out = [];
  for (let i = 0; i < max - 1; i++) out.push(points[Math.round(i * step)]);
  out.push(points[points.length - 1]);
  return out;
}

// Нужно ли принять новую GPS-точку в маршрут. Отсекаем:
//  - слишком неточные замеры (accuracy > 60 м), кроме самой первой точки;
//  - дрожание на месте (сдвиг меньше 12 м);
//  - «прыжки» GPS быстрее ~216 км/ч (60 м/с).
export const MIN_STEP_M = 12;
export const MAX_ACCURACY_M = 60;
export const MAX_SPEED_MS = 60;

export function shouldAcceptPoint(last, lat, lng, accuracy, tSec) {
  if (!last) return { ok: true, dist: 0 };
  if (accuracy != null && accuracy > MAX_ACCURACY_M) return { ok: false, dist: 0 };
  const dist = haversine(last[0], last[1], lat, lng);
  if (dist < MIN_STEP_M) return { ok: false, dist };
  const dt = Math.max(1, tSec - last[2]);
  if (dist / dt > MAX_SPEED_MS) return { ok: false, dist };
  return { ok: true, dist };
}
