import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import { getLocales } from "expo-localization";

import ja from "./locales/ja.json";
import en from "./locales/en.json";

const deviceLang = getLocales()[0]?.languageCode ?? "en";
const defaultLng = deviceLang === "ja" ? "ja" : "en";

i18n.use(initReactI18next).init({
  resources: { ja: { translation: ja }, en: { translation: en } },
  lng: defaultLng,
  fallbackLng: "en",
  interpolation: { escapeValue: false },
  compatibilityJSON: "v4",
});

export function setAppLanguage(lang: "auto" | "ja" | "en") {
  if (lang === "auto") {
    const dl = getLocales()[0]?.languageCode ?? "en";
    i18n.changeLanguage(dl === "ja" ? "ja" : "en");
  } else {
    i18n.changeLanguage(lang);
  }
}

export default i18n;
