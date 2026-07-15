import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { api } from "@/lib/api";
import { NewsCard } from "@/components/news/NewsCard";
import { T } from "@/lib/i18n";
import { ChevronLeft, ChevronRight } from "lucide-react";

const PAGE_SIZE = 12;

export default function Category() {
  const { slug } = useParams();
  const [data, setData] = useState({ items: [], total: 0, pages: 1 });
  const [cats, setCats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);

  useEffect(() => { setPage(1); }, [slug]);

  useEffect(() => {
    setLoading(true);
    (async () => {
      const [n, c] = await Promise.all([
        api.get(`/news?category=${slug}&page=${page}&limit=${PAGE_SIZE}`),
        api.get("/categories"),
      ]);
      setData(n.data);
      setCats(c.data);
      setLoading(false);
    })();
  }, [slug, page]);

  const cat = cats.find(c => c.slug === slug);
  const catName = cat?.name_te || (cats.length === 0 ? "" : slug);
  const catLabel = catName;

  const items = data.items;
  const featured = page === 1 ? items[0] : null;
  const rest = page === 1 ? items.slice(1) : items;

  return (
    <main className="max-w-7xl mx-auto px-4 py-8" data-testid={`category-page-${slug}`}>
      <div className="border-b-2 border-[#DC2626] pb-3 mb-6">
        <div className="cat-tag text-[#DC2626] mb-1">{T.category}</div>
        <h1 className="font-serif-editorial font-black text-4xl md:text-5xl">{catName}</h1>
        <p className="text-[#475569] mt-2">{data.total} {T.stories}</p>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 animate-pulse">
          {[1,2,3,4,5,6].map(i => <div key={i} className="h-64 bg-slate-200" />)}
        </div>
      ) : items.length === 0 ? (
        <div className="py-16 text-center text-[#475569]" data-testid="empty-state">
          <p className="font-serif-editorial text-2xl">{T.noStoriesYet}</p>
          <p className="text-sm mt-2">{T.checkBackSoon}</p>
        </div>
      ) : (
        <>
          {featured && (
            <div className="mb-8">
              <NewsCard item={featured} variant="hero" testId="cat-featured" categoryLabel={catLabel} />
            </div>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {rest.map((n, i) => <NewsCard key={n.id} item={n} testId={`cat-card-${i}`} categoryLabel={catLabel} />)}
          </div>
          {data.pages > 1 && (
            <div className="mt-8 flex items-center justify-center gap-3" data-testid="pagination">
              <button disabled={page <= 1} onClick={() => setPage(p => p - 1)}
                data-testid="page-prev"
                className="border border-[#E2E8F0] px-4 py-2 cat-tag disabled:opacity-40 hover:bg-slate-100 transition-colors flex items-center gap-1">
                <ChevronLeft className="w-4 h-4" /> {T.previous}
              </button>
              <span className="cat-tag text-[#475569]">
                {T.page} <span className="text-[#DC2626] font-bold">{page}</span> / {data.pages}
              </span>
              <button disabled={page >= data.pages} onClick={() => setPage(p => p + 1)}
                data-testid="page-next"
                className="border border-[#E2E8F0] px-4 py-2 cat-tag disabled:opacity-40 hover:bg-slate-100 transition-colors flex items-center gap-1">
                {T.next} <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </>
      )}
    </main>
  );
}
