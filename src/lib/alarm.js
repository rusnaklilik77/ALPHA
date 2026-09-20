// Сирена и вибрация для входящего SOS. Звук генерируется прямо в браузере
// (Web Audio API), поэтому никаких аудиофайлов в проекте не нужно.
//
// Важно: браузеры разрешают звук только после того, как человек хотя бы раз
// нажал/коснулся страницы. Если SOS пришёл на «холодную» открытую страницу, до
// которой пользователь ещё не дотрагивался, звука не будет — но окно на весь
// экран и вибрация (на телефонах) всё равно сработают.

let ctx = null;
let osc = null;
let gain = null;
let timer = null;
let vibTimer = null;
let running = false;

// Chrome блокирует вибрацию, пока человек ни разу не коснулся страницы, и
// пишет об этом в консоль — поэтому вибрируем только после первого касания.
function canVibrate() {
  if (!navigator.vibrate) return false;
  const ua = navigator.userActivation;
  return !ua || ua.hasBeenActive;
}

function getContext() {
  if (ctx) return ctx;
  const Ctor = window.AudioContext || window.webkitAudioContext;
  if (!Ctor) return null;
  try {
    ctx = new Ctor();
  } catch {
    ctx = null;
  }
  return ctx;
}

export function startAlarm() {
  stopAlarm();
  running = true;

  // Вибрация: три коротких импульса каждые ~2 секунды.
  try {
    if (navigator.vibrate) {
      if (canVibrate()) navigator.vibrate([400, 150, 400, 150, 400]);
      vibTimer = setInterval(() => {
        if (canVibrate()) navigator.vibrate([400, 150, 400, 150, 400]);
      }, 2000);
    }
  } catch {
    // ignore
  }

  const c = getContext();
  if (!c) return;
  try {
    if (c.state === "suspended") c.resume().catch(() => {});
    osc = c.createOscillator();
    gain = c.createGain();
    osc.type = "square";
    gain.gain.value = 0.15;
    osc.connect(gain);
    gain.connect(c.destination);
    osc.start();
    let high = true;
    const tick = () => {
      if (!osc) return;
      osc.frequency.setValueAtTime(high ? 880 : 620, c.currentTime);
      high = !high;
    };
    tick();
    timer = setInterval(tick, 450);
  } catch {
    // ignore
  }
}

export function stopAlarm() {
  if (!running) return;
  running = false;
  if (timer) clearInterval(timer);
  if (vibTimer) clearInterval(vibTimer);
  timer = null;
  vibTimer = null;
  try {
    if (canVibrate()) navigator.vibrate(0);
  } catch {
    // ignore
  }
  try {
    if (osc) {
      osc.stop();
      osc.disconnect();
    }
    if (gain) gain.disconnect();
  } catch {
    // ignore
  }
  osc = null;
  gain = null;
}

// Системное уведомление (если человек его разрешил). Работает, пока страница
// жива — в том числе в свёрнутой вкладке. На некоторых мобильных браузерах
// конструктор Notification недоступен — тогда просто молча пропускаем.
export function showSystemNotification(title, body) {
  try {
    if (typeof Notification === "undefined") return;
    if (Notification.permission !== "granted") return;
    const n = new Notification(title, {
      body,
      tag: "alpha-sos",
      requireInteraction: true,
      icon: "/lion-favicon.png",
    });
    n.onclick = () => {
      window.focus();
      n.close();
    };
  } catch {
    // ignore
  }
}
