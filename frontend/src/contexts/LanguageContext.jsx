import { createContext, useContext, useEffect, useState } from "react";
import { getLanguage, setLanguage as _setLanguage, LANGUAGES } from "@/lib/i18n";

const LanguageContext = createContext(null);

export function LanguageProvider({ children }) {
  const [lang, setLang] = useState(getLanguage());

  useEffect(() => {
    const h = (e) => setLang(e.detail || getLanguage());
    window.addEventListener("n9t-lang-change", h);
    return () => window.removeEventListener("n9t-lang-change", h);
  }, []);

  const changeLanguage = (newLang) => {
    _setLanguage(newLang);
    setLang(newLang);
  };

  return (
    <LanguageContext.Provider value={{ lang, setLanguage: changeLanguage, languages: LANGUAGES }}>
      <div key={lang}>{children}</div>
    </LanguageContext.Provider>
  );
}

export const useLanguage = () => useContext(LanguageContext) || {
  lang: getLanguage(), setLanguage: _setLanguage, languages: LANGUAGES
};
