import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { api, resolveImageUrl, formatDate } from "@/lib/api";
import { NewsCard } from "@/components/news/NewsCard";
import { Share2, Clock, User, X, Eye } from "lucide-react";
import DOMPurify from "dompurify";
import { T } from "@/lib/i18n";
import { toast } from "sonner";
import { getFontClass } from "@/lib/fonts";

export default function Article() {
  const { id } = useParams();
  const [article, setArticle] = useState(null);
  const [cats, setCats] = useState([]);
  const [related, setRelated] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lightbox, setLightbox] = useState(null);

  useEffect(() => {
    setLoading(true);
    (async () => {
      try {
        const [a, c] = await Promise.all([
          api.get(`/news/${id}`),
          api.get("/categories"),
        ]);
        setArticle(a.data);
        setCats(Array.isArray(c.data) ? c.data : []);
        const rel = await api.get(`/news?category=${a.data.category}&limit=6`);
        setRelated((rel.data.items || []).filter(n => n.id !== id).slice(0, 4));
      } catch (e) {
        setError("Not found");
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  const catName = (slug) => cats.find(c => c.slug === slug)?.name_te || slug;

  const doShare = async () => {
    const url = window.location.href;
    if (navigator.share) {
      try { await navigator.share({ title: article.title, url }); } catch (e) { /* cancel */ }
    } else {
      navigator.clipboard.writeText(url);
      toast.success("లింక్ కాపీ చేయబడింది");
    }
  };

  if (loading) return <div className="max-w-7xl mx-auto px-4 py-16 animate-pulse">
    <div className="h-8 bg-slate-200 w-1/2 mb-4" />
    <div className="h-96 bg-slate-200" />
  </div>;

  if (error || !article) return (
    <div className="max-w-7xl mx-auto px-4 py-16 text-center" data-testid="article-error">
      <h1 className="font-serif-editorial text-3xl">{T.articleNotFound}</h1>
      <Link to="/" className="text-[#DC2626] hover:underline mt-4 inline-block">{T.backToHome}</Link>
    </div>
  );

  const img = resolveImageUrl(article.image_url);
  const allImages = article.images && article.images.length > 0
    ? article.images.map(resolveImageUrl)
    : [];
  const cleanBody = DOMPurify.sanitize(article.body || "", {
    ALLOWED_TAGS: ["p","h1","h2","h3","h4","strong","em","b","i","u","a","ul","ol","li","blockquote","br","span","img"],
    ALLOWED_ATTR: ["href","target","rel","src","alt"],
  });

  const shareLinks = [
    { name: "Twitter", url: `https://twitter.com/intent/tweet?text=${encodeURIComponent(article.title)}&url=${encodeURIComponent(window.location.href)}` },
    { name: "Facebook", url: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(window.location.href)}` },
    { name: "WhatsApp", url: `https://api.whatsapp.com/send?text=${encodeURIComponent(article.title + " " + window.location.href)}` },
  ];

  return (
    <main className="max-w-7xl mx-auto px-4 py-8" data-testid="article-page">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <article className="lg:col-span-8">
          <div className="mb-4">
            <Link to={`/category/${article.category}`} className="cat-tag text-[#DC2626] hover:underline">
              {catName(article.category)}
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
          <div className="flex items-center gap-4 text-sm text-[#475569] border-y border-[#E2E8F0] py-3 mb-6 flex-wrap">
            <div className="flex items-center gap-1"><User className="w-4 h-4" /> {article.author}</div>
            <div className="flex items-center gap-1"><Clock className="w-4 h-4" /> {formatDate(article.created_at)}</div>
            {typeof article.views === "number" && article.views > 0 && (
              <div className="flex items-center gap-1" data-testid="article-views">
                <Eye className="w-4 h-4" /> {article.views} {T.views}
              </div>
            )}
            <div className="ml-auto flex items-center gap-2">
              <button data-testid="share-btn" onClick={doShare} className="flex items-center gap-1 hover:text-[#DC2626] transition-colors">
                <Share2 className="w-4 h-4" /> {T.share}
              </button>
              {shareLinks.map(s => (
                <a key={s.name} href={s.url} target="_blank" rel="noopener noreferrer"
                   data-testid={`share-${s.name.toLowerCase()}`}
                   className="cat-tag text-[0.65rem] border border-[#E2E8F0] px-2 py-1 hover:bg-[#DC2626] hover:text-white hover:border-[#DC2626] transition-colors">
                  {s.name}
                </a>
              ))}
            </div>
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

          <div
            className={`text-lg leading-relaxed article-body ${getFontClass(article.body_font)}`}
            data-testid="article-body"
            dangerouslySetInnerHTML={{ __html: cleanBody }}
          />

          {allImages.length > 0 && (
            <section className="mt-8" data-testid="photo-gallery">
              <h3 className="font-serif-editorial font-bold text-xl mb-3 border-b-2 border-[#DC2626] pb-2 inline-block">ఫోటో గ్యాలరీ</h3>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mt-4">
                {allImages.map((src, i) => (
                  <button key={i} onClick={() => setLightbox(src)} data-testid={`gallery-thumb-${i}`}
                    className="aspect-square overflow-hidden bg-slate-100 group">
                    <img src={src} alt={`Photo ${i + 1}`} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                  </button>
                ))}
              </div>
            </section>
          )}

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
            <div className="cat-tag text-[#DC2626] border-b-2 border-[#DC2626] pb-2">{T.relatedStories}</div>
            <div className="space-y-3">
              {related.map((n, i) => <NewsCard key={n.id} item={n} variant="compact" testId={`related-${i}`} categoryLabel={catName(n.category)} />)}
            </div>
          </div>
        </aside>
      </div>

      {lightbox && (
        <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4"
             onClick={() => setLightbox(null)} data-testid="lightbox">
          <button className="absolute top-4 right-4 text-white p-2" onClick={() => setLightbox(null)}>
            <X className="w-6 h-6" />
          </button>
          <img src={lightbox} alt="Full" className="max-w-full max-h-full object-contain" />
        </div>
      )}
    </main>
  );
}
