import { createContext, useContext, useEffect, useState } from "react";
import { api } from "@/lib/api";

const ThemeContext = createContext(null);

const DEFAULT_THEME = {
  primary_color: "#E11D2E",
  secondary_color: "#1E4B9C",
  accent_color: "#0F2A5C",
  logo_url: "/logo.png",
  tagline_te: "నమ్మకమైన తెలుగు వార్తలు · 24×7",
  tagline_en: "Trusted Telugu News · 24×7",
  site_name_te: "న్యూస్ 9 టుడే",
  site_name_en: "News 9 Today",
  font_scale: 1.0,
  default_language: "te",
};

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(DEFAULT_THEME);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get("/settings/theme");
        setTheme({ ...DEFAULT_THEME, ...data });
      } catch (e) { /* ignore */ }
    })();
  }, []);

  useEffect(() => {
    const style = document.getElementById("theme-vars") || document.createElement("style");
    style.id = "theme-vars";
    const scale = Math.max(0.7, Math.min(1.5, parseFloat(theme.font_scale) || 1.0));
    style.innerHTML = `
      :root {
        --brand-red: ${theme.primary_color};
        --brand-blue: ${theme.secondary_color};
        --brand-blue-dark: ${theme.accent_color};
      }
      html { font-size: ${16 * scale}px; }
      .bg-brand-red { background-color: ${theme.primary_color} !important; }
      .bg-brand-blue { background-color: ${theme.secondary_color} !important; }
      .bg-brand-blue-dark { background-color: ${theme.accent_color} !important; }
      .text-brand-red { color: ${theme.primary_color} !important; }
      .text-brand-blue { color: ${theme.secondary_color} !important; }
      .border-brand-red { border-color: ${theme.primary_color} !important; }
      .border-brand-blue { border-color: ${theme.secondary_color} !important; }
      .hover\\:bg-brand-red:hover { background-color: ${theme.primary_color} !important; filter: brightness(0.9); }
      .hover\\:bg-brand-blue:hover { background-color: ${theme.secondary_color} !important; filter: brightness(0.9); }
      .hover\\:text-brand-red:hover { color: ${theme.primary_color} !important; }
      .hover\\:border-brand-red:hover { border-color: ${theme.primary_color} !important; }
    `;
    if (!document.getElementById("theme-vars")) document.head.appendChild(style);
  }, [theme]);

  const reload = async () => {
    try {
      const { data } = await api.get("/settings/theme");
      setTheme({ ...DEFAULT_THEME, ...data });
    } catch (e) { /* ignore */ }
  };

  return <ThemeContext.Provider value={{ theme, reload }}>{children}</ThemeContext.Provider>;
}

export const useTheme = () => useContext(ThemeContext) || { theme: DEFAULT_THEME, reload: () => {} };
