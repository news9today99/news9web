import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { api, resolveImageUrl } from "@/lib/api";
import { Play, ChevronLeft, ChevronRight, Youtube } from "lucide-react";
import { T } from "@/lib/i18n";

// Shows YouTube-imported items in a horizontal-scrolling shorts-style rail
export default function ShortsRail() {
  const [items, setItems] = useState([]);
  const [active, setActive] = useState(null);
  const railRef = useRef(null);

  useEffect(() => {
    (async () => {
      try {
        // Prefer source=youtube; if empty, fall back to any items with youtube_url
        let { data } = await api.get("/news?source=youtube&limit=20");
        let list = data.items || [];
        if (!list.length) {
          const r = await api.get("/news?limit=40");
          list = (r.data.items || []).filter(n => n.youtube_url).slice(0, 12);
        }
        setItems(list);
      } catch (e) { /* ignore */ }
    })();
  }, []);

  const scrollBy = (dx) => railRef.current?.scrollBy({ left: dx, behavior: "smooth" });

  if (!items.length) return null;

  return (
    <section className="max-w-7xl mx-auto px-4 mt-12" data-testid="shorts-rail-section">
      <div className="flex items-center justify-between border-b-2 border-brand-red pb-2 mb-4">
        <h2 className="font-serif-editorial font-black text-2xl flex items-center gap-2">
          <Youtube className="w-6 h-6 text-brand-red" /> షార్ట్స్ · న్యూస్ వీడియోలు
        </h2>
        <div className="flex gap-1">
          <button onClick={() => scrollBy(-400)} data-testid="shorts-prev"
            className="border border-[#E2E8F0] p-2 hover:bg-slate-100 transition-colors">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button onClick={() => scrollBy(400)} data-testid="shorts-next"
            className="border border-[#E2E8F0] p-2 hover:bg-slate-100 transition-colors">
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
      <div ref={railRef} className="flex gap-3 overflow-x-auto snap-x snap-mandatory scroll-smooth pb-2" data-testid="shorts-rail">
        {items.map((n, i) => (
          <button key={n.id} onClick={() => setActive(n)}
            data-testid={`shorts-item-${i}`}
            className="snap-start flex-shrink-0 w-40 md:w-48 bg-black relative aspect-[9/16] overflow-hidden group">
            <img src={resolveImageUrl(n.image_url)} alt={n.title} className="w-full h-full object-cover opacity-90 group-hover:opacity-100 transition-opacity"/>
            <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent" />
            <div className="absolute bottom-0 left-0 right-0 p-2 text-white text-left">
              <div className="cat-tag text-brand-red text-[0.6rem]">{n.category}</div>
              <div className="text-xs font-medium leading-snug line-clamp-3 mt-1">{n.title}</div>
            </div>
            <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
              <Play className="w-12 h-12 text-white drop-shadow-lg" fill="white" />
            </div>
          </button>
        ))}
      </div>

      {active && (
        <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4"
             onClick={() => setActive(null)} data-testid="shorts-player">
          <div className="w-full max-w-md aspect-[9/16] bg-black" onClick={e => e.stopPropagation()}>
            <iframe className="w-full h-full" src={active.youtube_url} title={active.title}
                    frameBorder="0" allow="autoplay; encrypted-media" allowFullScreen/>
          </div>
          <button onClick={() => setActive(null)} className="absolute top-4 right-4 text-white text-sm border border-white/40 px-3 py-1">
            {T.cancel}
          </button>
        </div>
      )}
    </section>
  );
}
