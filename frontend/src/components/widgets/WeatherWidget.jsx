import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Cloud, CloudRain, Sun, CloudSnow, CloudLightning, Wind } from "lucide-react";
import { T } from "@/lib/i18n";

// WMO weather codes → icon
function iconFor(code) {
  if (code == null) return Cloud;
  if (code === 0 || code === 1) return Sun;
  if (code <= 3) return Cloud;
  if (code >= 45 && code <= 48) return Wind;
  if (code >= 51 && code <= 67) return CloudRain;
  if (code >= 71 && code <= 77) return CloudSnow;
  if (code >= 80 && code <= 82) return CloudRain;
  if (code >= 95) return CloudLightning;
  return Cloud;
}

export default function WeatherWidget() {
  const [data, setData] = useState(null);
  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get("/widgets/weather");
        setData(data);
      } catch (e) { /* ignore */ }
    })();
    const int = setInterval(async () => {
      try {
        const { data } = await api.get("/widgets/weather");
        setData(data);
      } catch (e) { /* ignore */ }
    }, 15 * 60 * 1000); // 15 min
    return () => clearInterval(int);
  }, []);

  if (!data) return null;
  const Icon = iconFor(data.weather_code);

  return (
    <div className="bg-white border border-[#E2E8F0]" data-testid="weather-widget">
      <div className="bg-brand-blue text-white px-4 py-2">
        <span className="cat-tag">{T.weather}</span>
      </div>
      <div className="p-4 flex items-center gap-3">
        <Icon className="w-10 h-10 text-brand-red" />
        <div>
          <div className="text-3xl font-serif-editorial font-black">
            {data.temp != null ? `${Math.round(data.temp)}°` : "—"}
          </div>
          <div className="text-sm text-[#475569]">{data.city}</div>
          {data.humidity != null && (
            <div className="text-xs text-[#475569]">తేమ: {data.humidity}%</div>
          )}
        </div>
      </div>
    </div>
  );
}
