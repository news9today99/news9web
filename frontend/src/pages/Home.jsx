import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "@/lib/api";
import { NewsCard } from "@/components/news/NewsCard";
import { Radio, TrendingUp } from "lucide-react";
import LivePlayer from "@/components/livetv/LivePlayer";
import AdSlot from "@/components/ads/AdSlot";
import WeatherWidget from "@/components/widgets/WeatherWidget";
import ShortsRail from "@/components/home/ShortsRail";
import { T } from "@/lib/i18n";

export default function Home() {
  const [news, setNews] = useState([]);
  const [cats, setCats] = useState([]);
  const [live, setLive] = useState(null);
  const [loading, setLoading] = useState(true);
  const [region, setRegion] = useState(null);

  useEffect(() => {
    // Listen to region change from RegionBanner via storage
    try {
      const saved = localStorage.getItem("n9t_region");
      if (saved) setRegion(JSON.parse(saved).region);
    } catch (e) { /* ignore */ }
    const handler = (e) => setRegion(e.detail);
    window.addEventListener("n9t-region-change", handler);
    return () => window.removeEventListener("n9t-region-change", handler);
  }, []);

  useEffect(() => {
    setLoading(true);
    (async () => {
      try {
        const url = region && region !== "national" ? `/news?region=${region}&limit=100` : "/news?limit=100";
        const [n, c, l] = await Promise.all([
          api.get(url),
          api.get("/categories"),
          api.get("/settings/livetv"),
        ]);
        setNews(n.data.items || []);
        setCats(c.data);
        setLive(l.data);
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    })();
  }, [region]);

  const featured = news.filter(n => n.is_featured);
  const hero = featured[0] || news[0];
  const heroSide = (featured.slice(1, 3).length > 0 ? featured.slice(1, 3) : news.filter(n => n.id !== hero?.id).slice(0, 2));
  const byCat = (cat) => news.filter(n => n.category === cat).slice(0, 4);
  const videos = news.filter(n => n.youtube_url).slice(0, 4);
  const latest = news.slice(0, 8);
  const catName = (slug) => cats.find(c => c.slug === slug)?.name_te || slug;

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="animate-pulse space-y-4">
          <div className="h-96 bg-slate-200" />
          <div className="grid grid-cols-4 gap-4">{[1,2,3,4].map(i => <div key={i} className="h-48 bg-slate-200" />)}</div>
        </div>
      </div>
    );
  }

  return (
    <main data-testid="home-page">
      {/* Hero grid */}
      <section className="max-w-7xl mx-auto px-4 pt-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 lg:h-[500px]">
          <div className="lg:col-span-8 h-full">
            {hero && <NewsCard item={hero} variant="hero" testId="hero-story" categoryLabel={catName(hero.category)} />}
          </div>
          <div className="lg:col-span-4 grid grid-cols-2 lg:grid-cols-1 gap-3 lg:auto-rows-fr min-h-0">
            {heroSide.map((n, i) => (
              <NewsCard key={n.id} item={n} testId={`hero-side-${i}`} categoryLabel={catName(n.category)} />
            ))}
          </div>
        </div>
      </section>

      {/* Latest + Live TV */}
      <section className="max-w-7xl mx-auto px-4 mt-12">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <div className="lg:col-span-8">
            <div className="flex items-center justify-between border-b-2 border-brand-red pb-2 mb-4">
              <h2 className="font-serif-editorial font-black text-2xl">{T.latestNews}</h2>
              <TrendingUp className="w-5 h-5 text-brand-red" />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {latest.map((n, i) => <NewsCard key={n.id} item={n} testId={`latest-card-${i}`} categoryLabel={catName(n.category)} />)}
            </div>
          </div>

          <aside className="lg:col-span-4 space-y-6">
            {/* Live TV */}
            <div className="bg-white border border-[#E2E8F0]" data-testid="live-tv-widget">
              <div className="bg-brand-red text-white px-4 py-2 flex items-center gap-2">
                <Radio className="w-4 h-4 animate-pulse" />
                <span className="cat-tag">{T.liveTv}</span>
              </div>
              <div className="bg-black">
                {live && <LivePlayer url={live.url} streamType={live.stream_type} titleTe={live.title_te} titleEn={live.title_en} />}
              </div>
              <div className="p-3 border-t border-[#E2E8F0] flex items-center justify-between">
                <div>
                  <div className="cat-tag text-brand-red">{T.onAir}</div>
                  <div className="font-serif-editorial font-bold text-base">{live?.title_te || "లైవ్ టీవీ"}</div>
                </div>
                <Link to="/live" className="cat-tag border border-brand-red text-brand-red px-2 py-1 hover:bg-brand-red hover:text-white transition-colors">
                  ఫుల్ స్క్రీన్
                </Link>
              </div>
            </div>

            {/* Weather */}
            <WeatherWidget />

            {/* Sidebar Ad */}
            <AdSlot placement="sidebar" testId="ad-sidebar-top" />

            {/* Trending */}
            <div className="bg-white border border-[#E2E8F0] p-4" data-testid="trending-widget">
              <div className="cat-tag text-brand-red border-b border-[#E2E8F0] pb-2 mb-3">{T.trendingNow}</div>
              <div className="space-y-3">
                {news.slice(0, 5).map((n, i) => (
                  <Link key={n.id} to={`/article/${n.id}`} className="flex gap-3 group" data-testid={`trending-${i}`}>
                    <div className="font-serif-editorial font-black text-3xl text-brand-red leading-none">
                      {String(i + 1).padStart(2, "0")}
                    </div>
                    <h4 className="text-sm font-medium leading-snug group-hover:text-brand-red transition-colors line-clamp-2">
                      {n.title}
                    </h4>
                  </Link>
                ))}
              </div>
            </div>
          </aside>
        </div>
      </section>

      {cats.filter(c => byCat(c.slug).length > 0).slice(0, 4).map(c => (
        <CategorySection key={c.slug} title={c.name_te} slug={c.slug} items={byCat(c.slug)} catLabel={c.name_te} />
      ))}

      {/* YouTube Shorts rail */}
      <ShortsRail />

      {videos.length > 0 && (
        <section className="max-w-7xl mx-auto px-4 mt-12">
          <div className="flex items-center justify-between border-b-2 border-brand-red pb-2 mb-4">
            <h2 className="font-serif-editorial font-black text-2xl">{T.abnVideos}</h2>
            <Link to="/category/videos" className="cat-tag text-brand-red hover:underline">{T.viewAll}</Link>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {videos.map((n, i) => <NewsCard key={n.id} item={n} testId={`video-card-${i}`} categoryLabel={catName(n.category)} />)}
          </div>
        </section>
      )}
    </main>
  );
}

function CategorySection({ title, slug, items, catLabel }) {
  return (
    <section className="max-w-7xl mx-auto px-4 mt-12" data-testid={`section-${slug}`}>
      <div className="flex items-center justify-between border-b-2 border-brand-red pb-2 mb-4">
        <h2 className="font-serif-editorial font-black text-2xl">{title}</h2>
        <Link to={`/category/${slug}`} className="cat-tag text-brand-red hover:underline">{T.viewAll}</Link>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {items.map((n, i) => <NewsCard key={n.id} item={n} testId={`${slug}-card-${i}`} categoryLabel={catLabel} />)}
      </div>
    </section>
  );
}
