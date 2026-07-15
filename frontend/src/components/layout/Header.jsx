import { Link, NavLink, useNavigate } from "react-router-dom";
import { Search, Radio, Menu, X, Phone, Mail, Globe } from "lucide-react";
import Marquee from "react-fast-marquee";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { T, catName } from "@/lib/i18n";
import { useTheme } from "@/contexts/ThemeContext";
import { useLanguage } from "@/contexts/LanguageContext";
import SocialLinks from "@/components/social/SocialLinks";

export default function Header({ flash = [] }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [q, setQ] = useState("");
  const [cats, setCats] = useState([]);
  const [contact, setContact] = useState(null);
  const { theme } = useTheme();
  const { lang, setLanguage, languages } = useLanguage();
  const nav = useNavigate();

  useEffect(() => {
    (async () => {
      try {
        const [c, ct] = await Promise.all([api.get("/categories"), api.get("/settings/contact")]);
        setCats(c.data);
        setContact(ct.data);
      } catch (e) { /* ignore */ }
    })();
  }, []);

  const submitSearch = (e) => {
    e.preventDefault();
    if (!q.trim()) return;
    nav(`/search?q=${encodeURIComponent(q.trim())}`);
    setSearchOpen(false); setMobileOpen(false);
  };

  return (
    <header data-testid="site-header" className="w-full">
      {/* Contact strip */}
      {contact && (
        <div className="bg-brand-blue-dark text-white text-xs hidden md:block">
          <div className="max-w-7xl mx-auto flex items-center justify-between px-4 py-1">
            <div className="flex items-center gap-4">
              <a href={`tel:${contact.phone}`} className="flex items-center gap-1 hover:text-brand-red transition-colors" data-testid="header-phone">
                <Phone className="w-3 h-3" /> {contact.phone}
              </a>
              <a href={`mailto:${contact.email}`} className="flex items-center gap-1 hover:text-brand-red transition-colors" data-testid="header-email">
                <Mail className="w-3 h-3" /> {contact.email}
              </a>
              <SocialLinks variant="header" />
            </div>
            <div className="flex items-center gap-4">
              <select value={lang} onChange={(e) => setLanguage(e.target.value)}
                data-testid="language-switcher"
                className="bg-transparent border border-slate-600 text-white text-xs px-2 py-0.5 focus:outline-none focus:border-brand-red cursor-pointer">
                {languages.map(l => (
                  <option key={l.code} value={l.code} className="text-black">{l.label}</option>
                ))}
              </select>
              <Link to="/privacy" className="hover:text-brand-red transition-colors">{T.privacy}</Link>
              <Link to="/terms" className="hover:text-brand-red transition-colors">{T.terms}</Link>
            </div>
          </div>
        </div>
      )}

      {/* Flash news marquee */}
      <div className="bg-brand-red text-white" data-testid="flash-news-bar">
        <div className="max-w-7xl mx-auto flex items-center gap-3 px-4 py-2">
          <span className="cat-tag bg-white text-brand-red px-2 py-1 whitespace-nowrap">{T.breakingNews}</span>
          <div className="flex-1 overflow-hidden">
            <Marquee pauseOnHover speed={45} gradient={false}>
              {flash.length ? flash.map((f) => (
                <Link key={f.id} to={`/article/${f.id}`} className="mx-8 hover:underline">
                  <span className="mr-2 inline-block w-1.5 h-1.5 bg-white align-middle" />
                  {f.title}
                </Link>
              )) : (
                <span className="mx-8">న్యూస్ 9 టుడే — తెలుగు తాజా వార్తలు, లైవ్ అప్‌డేట్‌లు</span>
              )}
            </Marquee>
          </div>
        </div>
      </div>

      {/* Logo bar */}
      <div className="bg-white border-b border-[#E2E8F0]">
        <div className="max-w-7xl mx-auto flex items-center justify-between px-4 py-3">
          <Link to="/" data-testid="site-logo" className="flex items-center gap-3">
            <img src={theme.logo_url || "/logo.png"} alt={theme.site_name_en || "News 9 Today"} className="h-14 md:h-16 w-auto" />
            <div className="hidden sm:block">
              <div className="cat-tag text-brand-blue text-[0.65rem]" data-testid="site-tagline">{theme.tagline_te || T.siteTagline}</div>
            </div>
          </Link>
          <div className="hidden md:flex items-center gap-3">
            <button
              data-testid="header-search-btn"
              onClick={() => setSearchOpen(!searchOpen)}
              className="p-2 hover:text-brand-red transition-colors"
              aria-label={T.search}
            >
              {searchOpen ? <X className="w-5 h-5" /> : <Search className="w-5 h-5" />}
            </button>
            <Link
              to="/live"
              data-testid="header-live-tv-btn"
              className="flex items-center gap-2 bg-brand-red hover:bg-brand-red text-white px-3 py-2 transition-colors"
            >
              <Radio className="w-4 h-4 animate-pulse" />
              <span className="cat-tag">{T.liveTv}</span>
            </Link>
            <Link
              to="/admin/login"
              data-testid="header-admin-link"
              className="border border-brand-blue text-brand-blue px-4 py-2 cat-tag hover:bg-brand-blue hover:text-white transition-colors"
            >
              {T.admin}
            </Link>
          </div>
          <button
            data-testid="mobile-menu-btn"
            className="md:hidden p-2"
            onClick={() => setMobileOpen(!mobileOpen)}
          >
            <Menu className="w-6 h-6" />
          </button>
        </div>

        {/* Search bar */}
        {searchOpen && (
          <div className="border-t border-[#E2E8F0] bg-slate-50">
            <form onSubmit={submitSearch} className="max-w-7xl mx-auto px-4 py-3 flex gap-2" data-testid="search-form">
              <input
                autoFocus
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder={T.searchPlaceholder}
                data-testid="search-input"
                className="flex-1 px-3 py-2 border border-[#E2E8F0] focus:outline-none focus:border-brand-red"
              />
              <button type="submit" data-testid="search-submit"
                className="bg-brand-red hover:bg-brand-red text-white px-4 py-2 cat-tag flex items-center gap-2 transition-colors">
                <Search className="w-4 h-4" /> {T.search}
              </button>
            </form>
          </div>
        )}
      </div>

      {/* Category nav */}
      <nav className="bg-brand-blue text-white sticky top-0 z-40 shadow-sm" data-testid="category-nav">
        <div className="max-w-7xl mx-auto px-4">
          <div className="hidden md:flex items-center gap-1 overflow-x-auto">
            <NavLink
              to="/"
              end
              data-testid="nav-home-link"
              className={({ isActive }) =>
                `px-4 py-3 cat-tag whitespace-nowrap transition-colors ${isActive ? "bg-brand-red" : "hover:bg-brand-blue-dark"}`
              }
            >
              {T.home}
            </NavLink>
            {cats.map((c) => (
              <NavLink
                key={c.slug}
                to={`/category/${c.slug}`}
                data-testid={`nav-${c.slug}-link`}
                className={({ isActive }) =>
                  `px-4 py-3 cat-tag whitespace-nowrap transition-colors ${isActive ? "bg-brand-red" : "hover:bg-brand-blue-dark"}`
                }
              >
                {catName(c)}
              </NavLink>
            ))}
            <NavLink to="/live" data-testid="nav-live-link"
              className={({ isActive }) =>
                `px-4 py-3 cat-tag whitespace-nowrap transition-colors ml-auto ${isActive ? "bg-brand-red" : "hover:bg-brand-red bg-brand-blue-dark"}`}>
              🔴 {T.liveTv}
            </NavLink>
          </div>
          {mobileOpen && (
            <div className="md:hidden flex flex-col py-2" data-testid="mobile-nav">
              <form onSubmit={submitSearch} className="flex gap-2 px-4 py-2">
                <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={T.searchPlaceholder}
                  className="flex-1 px-2 py-1 text-black text-sm"/>
                <button type="submit" className="bg-brand-red px-3 py-1 cat-tag text-xs"><Search className="w-4 h-4"/></button>
              </form>
              <NavLink to="/" end onClick={() => setMobileOpen(false)} className="px-4 py-2 cat-tag">{T.home}</NavLink>
              <NavLink to="/live" onClick={() => setMobileOpen(false)} className="px-4 py-2 cat-tag bg-brand-red">🔴 {T.liveTv}</NavLink>
              {cats.map((c) => (
                <NavLink key={c.slug} to={`/category/${c.slug}`} onClick={() => setMobileOpen(false)} className="px-4 py-2 cat-tag">
                  {catName(c)}
                </NavLink>
              ))}
              <Link to="/admin/login" onClick={() => setMobileOpen(false)} className="px-4 py-2 cat-tag">{T.admin}</Link>
            </div>
          )}
        </div>
      </nav>
    </header>
  );
}
