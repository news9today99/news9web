import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { api, resolveImageUrl, formatDate } from "@/lib/api";
import { NewsCard } from "@/components/news/NewsCard";
import { Share2, Clock, User } from "lucide-react";

export default function Article() {
  const { id } = useParams();
  const [article, setArticle] = useState(null);
  const [related, setRelated] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    setLoading(true);
    (async () => {
      try {
        const { data } = await api.get(`/news/${id}`);
        setArticle(data);
        const rel = await api.get(`/news?category=${data.category}&limit=6`);
        setRelated(rel.data.filter(n => n.id !== id).slice(0, 4));
      } catch (e) {
        setError("Article not found");
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  if (loading) {
    return <div className="max-w-7xl mx-auto px-4 py-16 animate-pulse">
      <div className="h-8 bg-slate-200 w-1/2 mb-4" />
      <div className="h-96 bg-slate-200" />
    </div>;
  }

  if (error || !article) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-16 text-center" data-testid="article-error">
        <h1 className="font-serif-editorial text-3xl">Article not found</h1>
        <Link to="/" className="text-[#DC2626] hover:underline mt-4 inline-block">← Back to Home</Link>
      </div>
    );
  }

  const img = resolveImageUrl(article.image_url);

  return (
    <main className="max-w-7xl mx-auto px-4 py-8" data-testid="article-page">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <article className="lg:col-span-8">
          <div className="mb-4">
            <Link to={`/category/${article.category}`} className="cat-tag text-[#DC2626] hover:underline">
              {article.category}
            </Link>
          </div>
          <h1 className="font-serif-editorial font-black text-3xl md:text-5xl leading-tight mb-4" data-testid="article-title">
            {article.title}
          </h1>
          {article.summary && (
            <p className="text-lg text-[#475569] leading-relaxed mb-6 font-serif-editorial italic">
              {article.summary}
            </p>
          )}
          <div className="flex items-center gap-4 text-sm text-[#475569] border-y border-[#E2E8F0] py-3 mb-6">
            <div className="flex items-center gap-1"><User className="w-4 h-4" /> {article.author}</div>
            <div className="flex items-center gap-1"><Clock className="w-4 h-4" /> {formatDate(article.created_at)}</div>
            <button data-testid="share-btn" className="ml-auto flex items-center gap-1 hover:text-[#DC2626] transition-colors">
              <Share2 className="w-4 h-4" /> Share
            </button>
          </div>

          {img && (
            <figure className="mb-6">
              <img src={img} alt={article.title} className="w-full max-h-[60vh] object-cover" />
            </figure>
          )}

          {article.youtube_url && (
            <div className="aspect-video mb-6 bg-black" data-testid="article-video">
              <iframe
                className="w-full h-full"
                src={article.youtube_url}
                title="Video"
                frameBorder="0"
                allow="accelerometer; autoplay; encrypted-media; picture-in-picture"
                allowFullScreen
              />
            </div>
          )}

          <div className="font-body text-lg leading-relaxed space-y-4 whitespace-pre-wrap" data-testid="article-body">
            {article.body}
          </div>

          {article.tags && article.tags.length > 0 && (
            <div className="mt-8 flex flex-wrap gap-2">
              {article.tags.map(t => (
                <span key={t} className="cat-tag bg-slate-100 text-[#0F172A] px-3 py-1 border border-[#E2E8F0]">
                  #{t}
                </span>
              ))}
            </div>
          )}
        </article>

        <aside className="lg:col-span-4">
          <div className="sticky top-20 space-y-4">
            <div className="cat-tag text-[#DC2626] border-b-2 border-[#DC2626] pb-2">Related Stories</div>
            <div className="space-y-3">
              {related.map((n, i) => <NewsCard key={n.id} item={n} variant="compact" testId={`related-${i}`} />)}
            </div>
          </div>
        </aside>
      </div>
    </main>
  );
}
