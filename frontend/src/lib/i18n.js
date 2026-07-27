import { dictionaries, LANGUAGES } from "./dictionaries";

const STORE_KEY = "n9t_lang";
const DEFAULT_LANG = "te";

const state = {
  lang: (typeof window !== "undefined" && localStorage.getItem(STORE_KEY)) || DEFAULT_LANG,
};

export function getLanguage() { return state.lang; }
export function setLanguage(lang) {
  if (!dictionaries[lang]) lang = DEFAULT_LANG;
  state.lang = lang;
  if (typeof window !== "undefined") {
    localStorage.setItem(STORE_KEY, lang);
    window.dispatchEvent(new CustomEvent("n9t-lang-change", { detail: lang }));
  }
}

// Proxy so T.foo always reads current-language value.
export const T = new Proxy({}, {
  get(_, key) {
    if (typeof key !== "string") return undefined;
    const dict = dictionaries[state.lang] || dictionaries[DEFAULT_LANG];
    return dict[key] ?? dictionaries[DEFAULT_LANG][key] ?? key;
  }
});

// Helper for category name based on language
export function catName(c) {
  if (!c) return "";
  const lang = state.lang;
  if (lang === "en") return c.name_en || c.name_te || c.slug;
  if (lang === "hi") return c.name_hi || c.name_te || c.name_en || c.slug;
  return c.name_te || c.name_en || c.slug;
}

export { LANGUAGES };
