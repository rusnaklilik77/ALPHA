import { createContext, useContext, useEffect, useMemo, useState } from "react";
import {
  dict,
  LANGS,
  WEEKDAYS_FULL,
  WEEKDAYS_MON_FIRST,
  MONTHS_GENITIVE,
  MONTHS_NOMINATIVE,
} from "../i18n/translations";

const LanguageContext = createContext(null);
const STORAGE_KEY = "alpha_lang";

function detectDefaultLang() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved && dict[saved]) return saved;
  } catch {
    // ignore
  }
  const nav = (navigator.language || "ru").slice(0, 2).toLowerCase();
  if (dict[nav]) return nav;
  return "ru";
}

export function LanguageProvider({ children }) {
  const [lang, setLangState] = useState(detectDefaultLang);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, lang);
    } catch {
      // ignore
    }
  }, [lang]);

  function setLang(next) {
    if (dict[next]) setLangState(next);
  }

  const value = useMemo(() => {
    const t = dict[lang] || dict.ru;
    return {
      lang,
      setLang,
      langs: LANGS,
      t,
      weekdaysFull: WEEKDAYS_FULL[lang] || WEEKDAYS_FULL.ru,
      weekdaysMonFirst: WEEKDAYS_MON_FIRST[lang] || WEEKDAYS_MON_FIRST.ru,
      monthsGenitive: MONTHS_GENITIVE[lang] || MONTHS_GENITIVE.ru,
      monthsNominative: MONTHS_NOMINATIVE[lang] || MONTHS_NOMINATIVE.ru,
    };
  }, [lang]);

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error("useLanguage must be used within LanguageProvider");
  return ctx;
}
