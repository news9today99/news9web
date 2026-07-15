import { useEffect, useState } from "react";
import { useLocation, Link } from "react-router-dom";
import { api } from "@/lib/api";
import { NewsCard } from "@/components/news/NewsCard";
import { T } from "@/lib/i18n";

function useQuery() {
  return new URLSearchParams(useLocation().search);
}

export default function Search() {
  const query = useQuery();
  const q = query.get("q") || "";
  const [items, setItems] = useState([]);
  const [cats, setCats] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!q) return;
    setLoading(true);
    (async () => {
      const [n, c] = await Promise.all([
        api.get(`/news?q=${encodeURIComponent(q)}&limit=50`),
        api.get("/categories"),
      ]);
      setItems(n.data.items || []);
      setCats(c.data);
      setLoading(false);
    })();
  }, [q]);

  const catName = (slug) => cats.find(c => c.slug === slug)?.name_te || slug;

  return (
    <main className="max-w-7xl mx-auto px-4 py-8" data-testid="search-page">
      <div className="border-b-2 border-[#DC2626] pb-3 mb-6">
        <div className="cat-tag text-[#DC2626] mb-1">{T.searchResults}</div>
        <h1 className="font-serif-editorial font-black text-3xl md:text-4xl">
          {T.resultsFor}: <span className="text-[#DC2626]">"{q}"</span>
        </h1>
        {!loading && <p className="text-[#475569] mt-2">{items.length} {T.stories}</p>}
      </div>
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 animate-pulse">
          {[1,2,3,4,5,6].map(i => <div key={i} className="h-64 bg-slate-200" />)}
        </div>
      ) : items.length === 0 ? (
        <div className="py-16 text-center text-[#475569]" data-testid="search-empty">
          <p className="font-serif-editorial text-2xl">{T.noResults}</p>
          <Link to="/" className="text-[#DC2626] hover:underline mt-4 inline-block">{T.backToHome}</Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {items.map((n, i) => <NewsCard key={n.id} item={n} testId={`search-result-${i}`} categoryLabel={catName(n.category)} />)}
        </div>
      )}
    </main>
  );
}
