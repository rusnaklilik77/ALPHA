import { useState } from "react";
import { useLanguage } from "../context/LanguageContext";

// Поле пароля с кнопкой-«глазом»: по нажатию временно показывает введённый
// текст вместо точек. Используется и на входе/регистрации (Auth.jsx), и в
// окне входа в режим администратора (AdminLoginModal.jsx).
export default function PasswordInput({
  value,
  onChange,
  placeholder,
  required,
  minLength,
  autoComplete,
  autoFocus,
  className = "",
}) {
  const { t } = useLanguage();
  const [visible, setVisible] = useState(false);

  return (
    <div className="relative">
      <input
        type={visible ? "text" : "password"}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        required={required}
        minLength={minLength}
        autoComplete={autoComplete}
        autoFocus={autoFocus}
        className={`w-full bg-panel2 border border-border rounded-lg pl-3 pr-10 py-2.5 text-white placeholder:text-muted/60 outline-none focus:border-accent transition ${className}`}
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? t.auth.hidePassword : t.auth.showPassword}
        title={visible ? t.auth.hidePassword : t.auth.showPassword}
        tabIndex={-1}
        className="absolute right-0 top-0 h-full w-10 flex items-center justify-center text-muted hover:text-white transition"
      >
        {visible ? (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
            <circle cx="12" cy="12" r="3" />
            <path d="M3 3l18 18" />
          </svg>
        ) : (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
            <circle cx="12" cy="12" r="3" />
          </svg>
        )}
      </button>
    </div>
  );
}
