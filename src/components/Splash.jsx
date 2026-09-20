import { useEffect, useState } from "react";
import splashLogo from "../assets/splash-logo.png";

// Заставка при запуске сайта / приложения: на весь экран появляется логотип
// ALPHA (лев) с анимацией, как экран загрузки, и только потом открывается
// само приложение. Приложение при этом уже грузится «под» заставкой
// (Firebase, вход в аккаунт), поэтому задержки почти нет.
//
// Тайминги (мс): логотип въезжает ~0.9 c, держится, и на 2400 мс заставка
// начинает плавно исчезать (0.5 c), после чего убирается совсем.
// Для людей с включённым «уменьшением анимации» всё вдвое короче и без
// движения — только плавное появление.

const SHOW_MS = 2400;
const FADE_MS = 500;

export default function Splash({ onDone }) {
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    const reduce =
      typeof window !== "undefined" &&
      window.matchMedia &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const show = reduce ? SHOW_MS / 2 : SHOW_MS;
    const t1 = setTimeout(() => setLeaving(true), show);
    const t2 = setTimeout(() => onDone?.(), show + FADE_MS);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [onDone]);

  return (
    <div
      className={`alpha-splash ${leaving ? "alpha-splash--leaving" : ""}`}
      role="status"
      aria-label="ALPHA"
    >
      <div className="alpha-splash__glow" />
      <div className="alpha-splash__stack">
        <div className="alpha-splash__ring" />
        <img src={splashLogo} alt="ALPHA" className="alpha-splash__logo" draggable="false" />
      </div>
      <div className="alpha-splash__title">ALPHA</div>
      <div className="alpha-splash__bar">
        <span />
      </div>
    </div>
  );
}
