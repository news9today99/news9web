export const TELUGU_FONTS = [
  { value: "", label: "Default (Noto Sans Telugu)", className: "font-te-noto", sample: "తెలుగు వార్తలు" },
  { value: "ramabhadra", label: "Ramabhadra రామభద్ర", className: "font-te-ramabhadra", sample: "తెలుగు వార్తలు" },
  { value: "ramaraja", label: "Ramaraja రామరాజా", className: "font-te-ramaraja", sample: "తెలుగు వార్తలు" },
  { value: "peddana", label: "Peddana పెద్దన", className: "font-te-peddana", sample: "తెలుగు వార్తలు" },
  { value: "suranna", label: "Suranna సురన్న", className: "font-te-suranna", sample: "తెలుగు వార్తలు" },
  { value: "suravaram", label: "Suravaram సురవరం", className: "font-te-suravaram", sample: "తెలుగు వార్తలు" },
  { value: "timmana", label: "Timmana తిమ్మన", className: "font-te-timmana", sample: "తెలుగు వార్తలు" },
  { value: "ntr", label: "NTR ఎన్టీఆర్", className: "font-te-ntr", sample: "తెలుగు వార్తలు" },
  { value: "mallanna", label: "Mallanna మల్లన్న", className: "font-te-mallanna", sample: "తెలుగు వార్తలు" },
  { value: "mandali", label: "Mandali మండలి", className: "font-te-mandali", sample: "తెలుగు వార్తలు" },
  { value: "dhurjati", label: "Dhurjati ధూర్జటి", className: "font-te-dhurjati", sample: "తెలుగు వార్తలు" },
  { value: "gurajada", label: "Gurajada గురజాడ", className: "font-te-gurajada", sample: "తెలుగు వార్తలు" },
  { value: "tenali", label: "Tenali Ramakrishna తెనాలి రామకృష్ణ", className: "font-te-tenali", sample: "తెలుగు వార్తలు" },
  { value: "lakki", label: "Lakki Reddy లక్కి రెడ్డి", className: "font-te-lakki", sample: "తెలుగు వార్తలు" },
  { value: "gidugu", label: "Gidugu గిడుగు", className: "font-te-gidugu", sample: "తెలుగు వార్తలు" },
  { value: "anek", label: "Anek Telugu అనేక్", className: "font-te-anek", sample: "తెలుగు వార్తలు" },
  { value: "hindguntur", label: "Hind Guntur హింద్ గుంటూర్", className: "font-te-hindguntur", sample: "తెలుగు వార్తలు" },
  { value: "ponnala", label: "Ponnala పొన్నల", className: "font-te-ponnala", sample: "తెలుగు వార్తలు" },
  { value: "krushna", label: "Sree Krushnadevaraya శ్రీ కృష్ణదేవరాయ", className: "font-te-krushna", sample: "తెలుగు వార్తలు" },
];

export function getFontClass(value) {
  const f = TELUGU_FONTS.find(t => t.value === (value || ""));
  return f ? f.className : "font-te-noto";
}
