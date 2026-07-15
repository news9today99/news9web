import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "@/lib/api";
import LivePlayer from "@/components/livetv/LivePlayer";
import { NewsCard } from "@/components/news/NewsCard";
import { Radio, Clock } from "lucide-react";
import { T } from "@/lib/i18n";
import { formatDate } from "@/lib/api";

export default function LivePage() {
  const [live, setLive] = useState(null);
  const [news, setNews] = useState([]);
  const [cats, setCats] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [l, n, c] = await Promise.all([
          api.get("/settings/livetv"),
          api.get("/news?limit=30"),
          api.get("/categories"),
        ]);
        setLive(l.data);
        setNews(n.data.items || []);
        setCats(c.data);
      } finally { setLoading(false); }
    })();
    // Refresh news feed every 60s (auto-update)
    const int = setInterval(async () => {
      try {
        const { data } = await api.get("/news?limit=30");
        setNews(data.items || []);
      } catch (e) { /* ignore */ }
    }, 60 * 1000);
    return () => clearInterval(int);
  }, []);

  const catName = (slug) => cats.find(c => c.slug === slug)?.name_te || slug;

  if (loading) return <div className="max-w-7xl mx-auto p-8">{T.loading}</div>;

  return (
    <main className="min-h-screen" data-testid="live-page">
      {/* Player section */}
      <section className="bg-brand-blue-dark text-white">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="flex items-center gap-2 bg-brand-red px-3 py-1">
              <Radio className="w-4 h-4 animate-pulse" />
              <span className="cat-tag">{T.live}</span>
            </div>
            <h1 className="font-serif-editorial font-black text-2xl md:text-3xl">
              {live?.title_te || T.liveTv}
            </h1>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-9 bg-black">
              {live && <LivePlayer url={live.url} streamType={live.stream_type}
                                    titleTe={live.title_te} titleEn={live.title_en} />}
            </div>
            <aside className="lg:col-span-3 space-y-2 max-h-[480px] overflow-y-auto pr-2" data-testid="live-side-feed">
              <div className="cat-tag text-brand-red border-b border-slate-700 pb-2">{T.trendingNow}</div>
              {news.slice(0, 6).map((n, i) => (
                <Link key={n.id} to={`/article/${n.id}`}
                  className="flex gap-2 p-2 hover:bg-brand-blue transition-colors group"
                  data-testid={`live-side-item-${i}`}>
                  <div className="w-16 h-16 flex-shrink-0 overflow-hidden bg-black">
                    <img src={n.image_url} alt={n.title} className="w-full h-full object-cover" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs text-brand-red cat-tag">{catName(n.category)}</div>
                    <div className="text-sm font-medium leading-snug line-clamp-2 group-hover:text-brand-red">{n.title}</div>
                    <div className="text-xs text-slate-400 flex items-center gap-1 mt-1">
                      <Clock className="w-3 h-3" /> {formatDate(n.created_at)}
                    </div>
                  </div>
                </Link>
              ))}
            </aside>
          </div>
        </div>
      </section>

      {/* News feed under the player */}
      <section className="max-w-7xl mx-auto px-4 py-8" data-testid="live-below-feed">
        <div className="border-b-2 border-brand-red pb-2 mb-6">
          <h2 className="font-serif-editorial font-black text-2xl">{T.latestNewsFeed}</h2>
          <p className="text-xs text-[#475569] mt-1">ప్రతి 60 సెకన్లకు ఆటో-అప్‌డేట్</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {news.slice(0, 12).map((n, i) => (
            <NewsCard key={n.id} item={n} testId={`live-feed-card-${i}`} categoryLabel={catName(n.category)} />
          ))}
        </div>
      </section>
    </main>
  );
}
