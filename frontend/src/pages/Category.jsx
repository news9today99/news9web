import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { api } from "@/lib/api";
import { NewsCard } from "@/components/news/NewsCard";

const CAT_NAMES = {
  politics: "Politics",
  sports: "Sports",
  cinema: "Cinema",
  business: "Business",
  technology: "Technology",
  health: "Health",
  photos: "Photos",
  videos: "Videos",
};

export default function Category() {
  const { slug } = useParams();
  const [news, setNews] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    (async () => {
      const { data } = await api.get(`/news?category=${slug}&limit=100`);
      setNews(data);
      setLoading(false);
    })();
  }, [slug]);

  const featured = news[0];
  const rest = news.slice(1);

  return (
    <main className="max-w-7xl mx-auto px-4 py-8" data-testid={`category-page-${slug}`}>
      <div className="border-b-2 border-[#DC2626] pb-3 mb-6">
        <div className="cat-tag text-[#DC2626] mb-1">Category</div>
        <h1 className="font-serif-editorial font-black text-4xl md:text-5xl">
          {CAT_NAMES[slug] || slug}
        </h1>
        <p className="text-[#475569] mt-2">{news.length} stories</p>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 animate-pulse">
          {[1,2,3,4,5,6].map(i => <div key={i} className="h-64 bg-slate-200" />)}
        </div>
      ) : news.length === 0 ? (
        <div className="py-16 text-center text-[#475569]" data-testid="empty-state">
          <p className="font-serif-editorial text-2xl">No stories yet in this section.</p>
          <p className="text-sm mt-2">Check back soon.</p>
        </div>
      ) : (
        <>
          {featured && (
            <div className="mb-8">
              <NewsCard item={featured} variant="hero" testId="cat-featured" />
            </div>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {rest.map((n, i) => <NewsCard key={n.id} item={n} testId={`cat-card-${i}`} />)}
          </div>
        </>
      )}
    </main>
  );
}
