import { createContext, useContext, useState, useEffect } from "react";
import { translations, type Language, type TranslationKey } from "@/lib/i18n";

interface LanguageContextValue {
  language: Language;
  t: (key: TranslationKey) => any;
  toggleLanguage: () => void;
}

const LanguageContext = createContext<LanguageContextValue>({
  language: "ar",
  t: (key) => translations.ar[key],
  toggleLanguage: () => {},
});

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguage] = useState<Language>(() => {
    try {
      return (localStorage.getItem("mawid-lang") as Language) || "ar";
    } catch {
      return "ar";
    }
  });

  useEffect(() => {
    const dict = translations[language];
    document.documentElement.lang = dict.lang;
    document.documentElement.dir = dict.dir;
    try {
      localStorage.setItem("mawid-lang", language);
    } catch {}
  }, [language]);

  const toggleLanguage = () =>
    setLanguage(prev => (prev === "ar" ? "en" : "ar"));

  const t = (key: TranslationKey): any => translations[language][key];

  return (
    <LanguageContext.Provider value={{ language, t, toggleLanguage }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  return useContext(LanguageContext);
}
