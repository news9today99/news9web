import { Link } from "react-router-dom";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { T } from "@/lib/i18n";
import { Phone, Mail, MapPin } from "lucide-react";

export default function Footer() {
  const [cats, setCats] = useState([]);
  const [contact, setContact] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const [c, ct] = await Promise.all([api.get("/categories"), api.get("/settings/contact")]);
        setCats(c.data);
        setContact(ct.data);
      } catch (e) { /* ignore */ }
    })();
  }, []);

  const half = Math.ceil(cats.length / 2);
  const left = cats.slice(0, half);
  const right = cats.slice(half);

  return (
    <footer data-testid="site-footer" className="mt-16 bg-brand-blue-dark text-white">
      <div className="max-w-7xl mx-auto px-4 py-12 grid grid-cols-1 md:grid-cols-4 gap-8">
        <div>
          <img src="/logo.png" alt="News 9 Today" className="h-16 w-auto mb-3 bg-white p-2 inline-block" />
          <p className="text-sm text-slate-300 leading-relaxed mb-4">{T.footerTagline}</p>
          {contact && (
            <div className="space-y-2 text-sm">
              <a href={`tel:${contact.phone}`} className="flex items-center gap-2 hover:text-brand-red transition-colors">
                <Phone className="w-4 h-4" /> {contact.phone}
              </a>
              <a href={`mailto:${contact.email}`} className="flex items-center gap-2 hover:text-brand-red transition-colors break-all">
                <Mail className="w-4 h-4" /> {contact.email}
              </a>
              {contact.address && (
                <div className="flex items-center gap-2 text-slate-400">
                  <MapPin className="w-4 h-4" /> {contact.address}
                </div>
              )}
            </div>
          )}
        </div>
        <div>
          <div className="cat-tag text-brand-red mb-3">{T.sections}</div>
          <ul className="space-y-2 text-sm">
            {left.map(c => (
              <li key={c.slug}>
                <Link to={`/category/${c.slug}`} className="hover:text-brand-red transition-colors">{c.name_te}</Link>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <div className="cat-tag text-brand-red mb-3">{T.more}</div>
          <ul className="space-y-2 text-sm">
            {right.map(c => (
              <li key={c.slug}>
                <Link to={`/category/${c.slug}`} className="hover:text-brand-red transition-colors">{c.name_te}</Link>
              </li>
            ))}
            <li><Link to="/live" className="hover:text-brand-red transition-colors">🔴 {T.liveTv}</Link></li>
            <li><Link to="/privacy" className="hover:text-brand-red transition-colors">{T.privacy}</Link></li>
            <li><Link to="/terms" className="hover:text-brand-red transition-colors">{T.terms}</Link></li>
          </ul>
        </div>
        <div>
          <div className="cat-tag text-brand-red mb-3">{T.newsletter}</div>
          <p className="text-sm text-slate-300 mb-3">{T.newsletterDesc}</p>
          <div className="flex">
            <input type="email" placeholder={T.yourEmail} data-testid="footer-newsletter-input"
              className="flex-1 bg-slate-800 text-white px-3 py-2 text-sm border border-slate-700 focus:outline-none focus:border-brand-red min-w-0"/>
            <button data-testid="footer-newsletter-btn"
              className="bg-brand-red hover:bg-brand-red transition-colors px-4 py-2 cat-tag whitespace-nowrap">
              {T.subscribe}
            </button>
          </div>
        </div>
      </div>
      <div className="border-t border-slate-800">
        <div className="max-w-7xl mx-auto px-4 py-4 text-xs text-slate-400 flex flex-col md:flex-row justify-between gap-2">
          <span>{T.allRightsReserved}</span>
          <span>{T.editorialTrusted}</span>
        </div>
      </div>
    </footer>
  );
}
