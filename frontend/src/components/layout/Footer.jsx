import { Link } from "react-router-dom";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { T } from "@/lib/i18n";

export default function Footer() {
  const [cats, setCats] = useState([]);
  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get("/categories");
        setCats(data);
      } catch (e) { /* ignore */ }
    })();
  }, []);

  const half = Math.ceil(cats.length / 2);
  const left = cats.slice(0, half);
  const right = cats.slice(half);

  return (
    <footer data-testid="site-footer" className="mt-16 bg-[#0F172A] text-white">
      <div className="max-w-7xl mx-auto px-4 py-12 grid grid-cols-1 md:grid-cols-4 gap-8">
        <div>
          <div className="font-serif-editorial font-black text-2xl mb-2">ఏబీఎన్ ఆంధ్ర న్యూస్</div>
          <p className="text-sm text-slate-400 leading-relaxed">{T.footerTagline}</p>
        </div>
        <div>
          <div className="cat-tag text-[#DC2626] mb-3">{T.sections}</div>
          <ul className="space-y-2 text-sm">
            {left.map(c => (
              <li key={c.slug}>
                <Link to={`/category/${c.slug}`} className="hover:text-[#DC2626] transition-colors">{c.name_te}</Link>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <div className="cat-tag text-[#DC2626] mb-3">{T.more}</div>
          <ul className="space-y-2 text-sm">
            {right.map(c => (
              <li key={c.slug}>
                <Link to={`/category/${c.slug}`} className="hover:text-[#DC2626] transition-colors">{c.name_te}</Link>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <div className="cat-tag text-[#DC2626] mb-3">{T.newsletter}</div>
          <p className="text-sm text-slate-400 mb-3">{T.newsletterDesc}</p>
          <div className="flex">
            <input
              type="email"
              placeholder={T.yourEmail}
              data-testid="footer-newsletter-input"
              className="flex-1 bg-slate-800 text-white px-3 py-2 text-sm border border-slate-700 focus:outline-none focus:border-[#DC2626] min-w-0"
            />
            <button data-testid="footer-newsletter-btn" className="bg-[#DC2626] hover:bg-[#B91C1C] transition-colors px-4 py-2 cat-tag whitespace-nowrap">
              {T.subscribe}
            </button>
          </div>
        </div>
      </div>
      <div className="border-t border-slate-800">
        <div className="max-w-7xl mx-auto px-4 py-4 text-xs text-slate-500 flex flex-col md:flex-row justify-between gap-2">
          <span>{T.allRightsReserved}</span>
          <span>{T.editorialTrusted}</span>
        </div>
      </div>
    </footer>
  );
}
