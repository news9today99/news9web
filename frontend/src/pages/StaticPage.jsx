import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { api } from "@/lib/api";
import DOMPurify from "dompurify";
import { T } from "@/lib/i18n";

const TITLES = {
  privacy: T.privacyPolicy,
  terms: T.termsConditions,
};

export default function StaticPage() {
  const location = useLocation();
  const slug = location.pathname.replace("/", "").split("/")[0] || "privacy";
  const [page, setPage] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    (async () => {
      try {
        const { data } = await api.get(`/pages/${slug}`);
        setPage(data);
      } catch (e) {
        setPage(null);
      } finally {
        setLoading(false);
      }
    })();
  }, [slug]);

  if (loading) return <div className="max-w-4xl mx-auto p-8">{T.loading}</div>;
  if (!page) return <div className="max-w-4xl mx-auto p-8">404</div>;

  const clean = DOMPurify.sanitize(page.body || "", {
    ALLOWED_TAGS: ["p","h1","h2","h3","h4","strong","em","b","i","u","a","ul","ol","li","blockquote","br","span"],
    ALLOWED_ATTR: ["href","target","rel"],
  });

  return (
    <main className="max-w-4xl mx-auto px-4 py-8" data-testid={`page-${slug}`}>
      <div className="border-b-2 border-brand-red pb-3 mb-6">
        <div className="cat-tag text-brand-red mb-1">{TITLES[slug] || page.title_en}</div>
        <h1 className="font-serif-editorial font-black text-3xl md:text-4xl">{page.title_te || page.title_en}</h1>
      </div>
      <div className="article-body text-lg leading-relaxed" dangerouslySetInnerHTML={{ __html: clean }} />
    </main>
  );
}
