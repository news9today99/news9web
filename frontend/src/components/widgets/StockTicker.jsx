import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { T } from "@/lib/i18n";

export default function StockTicker() {
  const [items, setItems] = useState([]);
  useEffect(() => {
    const load = async () => {
      try {
        const { data } = await api.get("/widgets/stock");
        setItems(data.items || []);
      } catch (e) { /* ignore */ }
    };
    load();
    const int = setInterval(load, 5 * 60 * 1000); // refresh every 5 min
    return () => clearInterval(int);
  }, []);

  if (!items.length) return null;

  // duplicate items so the marquee loop is seamless
  const doubled = [...items, ...items];

  return (
    <div className="bg-brand-blue-dark text-white overflow-hidden" data-testid="stock-ticker">
      <div className="max-w-7xl mx-auto px-4 flex items-stretch">
        <div className="bg-brand-red px-3 py-2 flex items-center whitespace-nowrap">
          <span className="cat-tag text-white">{T.stockMarket}</span>
        </div>
        <div className="flex-1 overflow-hidden">
          <div className="stock-ticker-track flex whitespace-nowrap py-2">
            {doubled.map((it, i) => {
              const up = (it.change ?? 0) > 0;
              const down = (it.change ?? 0) < 0;
              const Icon = up ? TrendingUp : down ? TrendingDown : Minus;
              return (
                <div key={`${it.symbol}-${i}`} className="mx-6 flex items-center gap-2 text-sm">
                  <span className="font-bold">{it.label}</span>
                  <span>{it.price != null ? it.price.toLocaleString() : "—"}</span>
                  {it.change != null && (
                    <span className={`flex items-center gap-1 ${up ? "text-green-400" : down ? "text-red-400" : "text-slate-300"}`}>
                      <Icon className="w-3 h-3" />
                      {it.change > 0 ? "+" : ""}{it.change} ({it.change_pct}%)
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
