import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { MapPin, X } from "lucide-react";

const STORE_KEY = "n9t_region";

export default function RegionBanner({ onRegionChange }) {
  const [regions, setRegions] = useState([]);
  const [current, setCurrent] = useState(null);
  const [dismissed, setDismissed] = useState(false);
  const [showPicker, setShowPicker] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get("/regions");
        setRegions(data);
      } catch (e) { /* ignore */ }
    })();

    const saved = localStorage.getItem(STORE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setCurrent(parsed);
        onRegionChange?.(parsed.region);
        return;
      } catch (e) { /* fall through */ }
    }

    // Try geolocation
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          try {
            const { data } = await api.get(`/geo/detect-region?lat=${pos.coords.latitude}&lon=${pos.coords.longitude}`);
            const region = { region: data.region, name_te: data.name_te, name_en: data.name_en, auto: true };
            setCurrent(region);
            localStorage.setItem(STORE_KEY, JSON.stringify(region));
            onRegionChange?.(data.region);
          } catch (e) { /* ignore */ }
        },
        () => { /* denied — do nothing, user gets national */ },
        { timeout: 8000 }
      );
    }
  }, [onRegionChange]);

  const pick = (r) => {
    const region = { region: r.slug, name_te: r.name_te, name_en: r.name_en, auto: false };
    setCurrent(region);
    localStorage.setItem(STORE_KEY, JSON.stringify(region));
    onRegionChange?.(r.slug);
    setShowPicker(false);
  };

  if (dismissed) return null;

  return (
    <div className="bg-brand-blue-dark text-white" data-testid="region-banner">
      <div className="max-w-7xl mx-auto px-4 py-2 flex items-center justify-between text-sm">
        <div className="flex items-center gap-2 flex-wrap">
          <MapPin className="w-4 h-4 text-brand-red" />
          {current ? (
            <span>
              మీ ప్రాంతం: <strong data-testid="region-current" className="text-brand-red">{current.name_te}</strong>
              {current.auto && <span className="text-xs text-slate-400 ml-1">(ఆటో)</span>}
            </span>
          ) : (
            <span>ప్రాంతం ఎంచుకోండి</span>
          )}
          <button data-testid="region-change-btn" onClick={() => setShowPicker(!showPicker)}
            className="ml-2 underline hover:text-brand-red">
            మార్చండి
          </button>
        </div>
        <button data-testid="region-close-btn" onClick={() => setDismissed(true)}
          className="text-slate-400 hover:text-white p-1">
          <X className="w-4 h-4" />
        </button>
      </div>
      {showPicker && (
        <div className="border-t border-slate-700 bg-slate-900" data-testid="region-picker">
          <div className="max-w-7xl mx-auto px-4 py-3 flex flex-wrap gap-2">
            {regions.map(r => (
              <button key={r.slug} onClick={() => pick(r)}
                data-testid={`region-pick-${r.slug}`}
                className={`px-3 py-1 cat-tag transition-colors ${
                  current?.region === r.slug ? "bg-brand-red text-white" : "border border-slate-600 hover:bg-slate-800"
                }`}>
                {r.name_te}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
