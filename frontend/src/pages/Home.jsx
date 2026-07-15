import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "@/lib/api";
import { NewsCard } from "@/components/news/NewsCard";
import { Radio, TrendingUp } from "lucide-react";

export default function Home() {
  const [news, setNews] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get("/news?limit=50");
        setNews(data);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const featured = news.filter(n => n.is_featured);
  const hero = featured[0] || news[0];
  const heroSide = featured.slice(1, 5);
  const byCat = (cat) => news.filter(n => n.category === cat).slice(0, 4);
  const videos = news.filter(n => n.youtube_url).slice(0, 4);
  const latest = news.slice(0, 8);

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="animate-pulse space-y-4">
          <div className="h-96 bg-slate-200" />
          <div className="grid grid-cols-4 gap-4">
            {[1,2,3,4].map(i => <div key={i} className="h-48 bg-slate-200" />)}
          </div>
        </div>
      </div>
    );
  }

  return (
    <main data-testid="home-page">
      {/* Hero grid */}
      <section className="max-w-7xl mx-auto px-4 pt-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          <div className="lg:col-span-8">
            {hero && <NewsCard item={hero} variant="hero" testId="hero-story" />}
          </div>
          <div className="lg:col-span-4 grid grid-cols-2 lg:grid-cols-1 gap-3">
            {heroSide.map((n, i) => (
              <NewsCard key={n.id} item={n} testId={`hero-side-${i}`} />
            ))}
          </div>
        </div>
      </section>

      {/* Latest + Live TV */}
      <section className="max-w-7xl mx-auto px-4 mt-12">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <div className="lg:col-span-8">
            <div className="flex items-center justify-between border-b-2 border-[#DC2626] pb-2 mb-4">
              <h2 className="font-serif-editorial font-black text-2xl">Latest News</h2>
              <TrendingUp className="w-5 h-5 text-[#DC2626]" />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {latest.map((n, i) => <NewsCard key={n.id} item={n} testId={`latest-card-${i}`} />)}
            </div>
          </div>

          <aside className="lg:col-span-4 space-y-6">
            {/* Live TV widget */}
            <div className="bg-white border border-[#E2E8F0]" data-testid="live-tv-widget">
              <div className="bg-[#DC2626] text-white px-4 py-2 flex items-center gap-2">
                <Radio className="w-4 h-4 animate-pulse" />
                <span className="cat-tag">LIVE TV</span>
              </div>
              <div className="aspect-video bg-black relative overflow-hidden">
                <iframe
                  className="w-full h-full"
                  src="https://www.youtube.com/embed/jfKfPfyJRdk?autoplay=0&mute=1"
                  title="Live TV"
                  frameBorder="0"
                  allow="accelerometer; autoplay; encrypted-media; picture-in-picture"
                  allowFullScreen
                />
              </div>
              <div className="p-3 border-t border-[#E2E8F0]">
                <div className="cat-tag text-[#DC2626] mb-1">On Air</div>
                <div className="font-serif-editorial font-bold text-base">Andhra News 24×7</div>
              </div>
            </div>

            {/* Trending */}
            <div className="bg-white border border-[#E2E8F0] p-4" data-testid="trending-widget">
              <div className="cat-tag text-[#DC2626] border-b border-[#E2E8F0] pb-2 mb-3">Trending Now</div>
              <div className="space-y-3">
                {news.slice(0, 5).map((n, i) => (
                  <Link key={n.id} to={`/article/${n.id}`} className="flex gap-3 group" data-testid={`trending-${i}`}>
                    <div className="font-serif-editorial font-black text-3xl text-[#DC2626] leading-none">
                      {String(i + 1).padStart(2, "0")}
                    </div>
                    <h4 className="text-sm font-medium leading-snug group-hover:text-[#DC2626] transition-colors line-clamp-2">
                      {n.title}
                    </h4>
                  </Link>
                ))}
              </div>
            </div>
          </aside>
        </div>
      </section>

      {/* Sports */}
      {byCat("sports").length > 0 && (
        <CategorySection title="Sports" slug="sports" items={byCat("sports")} />
      )}

      {/* Cinema */}
      {byCat("cinema").length > 0 && (
        <CategorySection title="Cinema" slug="cinema" items={byCat("cinema")} />
      )}

      {/* Videos */}
      {videos.length > 0 && (
        <section className="max-w-7xl mx-auto px-4 mt-12">
          <div className="flex items-center justify-between border-b-2 border-[#DC2626] pb-2 mb-4">
            <h2 className="font-serif-editorial font-black text-2xl">ABN Videos</h2>
            <Link to="/category/videos" className="cat-tag text-[#DC2626] hover:underline">View all →</Link>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {videos.map((n, i) => <NewsCard key={n.id} item={n} testId={`video-card-${i}`} />)}
          </div>
        </section>
      )}

      {/* Photos */}
      {byCat("photos").length > 0 && (
        <CategorySection title="Photos" slug="photos" items={byCat("photos")} />
      )}
    </main>
  );
}

function CategorySection({ title, slug, items }) {
  return (
    <section className="max-w-7xl mx-auto px-4 mt-12" data-testid={`section-${slug}`}>
      <div className="flex items-center justify-between border-b-2 border-[#DC2626] pb-2 mb-4">
        <h2 className="font-serif-editorial font-black text-2xl">{title}</h2>
        <Link to={`/category/${slug}`} className="cat-tag text-[#DC2626] hover:underline">
          View all →
        </Link>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {items.map((n, i) => <NewsCard key={n.id} item={n} testId={`${slug}-card-${i}`} />)}
      </div>
    </section>
  );
}
