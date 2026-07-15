import { Link, NavLink, useNavigate } from "react-router-dom";
import { Search, Radio, Menu, X } from "lucide-react";
import Marquee from "react-fast-marquee";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { T } from "@/lib/i18n";

export default function Header({ flash = [] }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [q, setQ] = useState("");
  const [cats, setCats] = useState([]);
  const nav = useNavigate();

  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get("/categories");
        setCats(data);
      } catch (e) { /* ignore */ }
    })();
  }, []);

  const submitSearch = (e) => {
    e.preventDefault();
    if (!q.trim()) return;
    nav(`/search?q=${encodeURIComponent(q.trim())}`);
    setSearchOpen(false);
    setMobileOpen(false);
  };

  return (
    <header data-testid="site-header" className="w-full">
      {/* Flash news marquee */}
      <div className="bg-[#DC2626] text-white" data-testid="flash-news-bar">
        <div className="max-w-7xl mx-auto flex items-center gap-3 px-4 py-2">
          <span className="cat-tag bg-white text-[#DC2626] px-2 py-1 whitespace-nowrap">{T.flashNews}</span>
          <div className="flex-1 overflow-hidden">
            <Marquee pauseOnHover speed={45} gradient={false}>
              {flash.length ? flash.map((f) => (
                <Link key={f.id} to={`/article/${f.id}`} className="mx-8 hover:underline">
                  <span className="mr-2 inline-block w-1.5 h-1.5 bg-white align-middle" />
                  {f.title}
                </Link>
              )) : (
                <span className="mx-8">ఏబీఎన్ ఆంధ్ర న్యూస్ పోర్టల్‌కు స్వాగతం — తాజా వార్తలు, లైవ్ అప్‌డేట్‌లు</span>
              )}
            </Marquee>
          </div>
        </div>
      </div>

      {/* Logo bar */}
      <div className="bg-white border-b border-[#E2E8F0]">
        <div className="max-w-7xl mx-auto flex items-center justify-between px-4 py-4">
          <Link to="/" data-testid="site-logo" className="flex items-center gap-3">
            <div className="bg-[#DC2626] text-white font-serif-editorial font-black text-2xl px-3 py-1 tracking-tight">
              ABN
            </div>
            <div>
              <div className="font-serif-editorial font-black text-2xl text-[#0F172A] leading-none">ఆంధ్ర న్యూస్</div>
              <div className="cat-tag text-[#475569] text-[0.65rem] mt-1">{T.editorialSince}</div>
            </div>
          </Link>
          <div className="hidden md:flex items-center gap-3">
            <button
              data-testid="header-search-btn"
              onClick={() => setSearchOpen(!searchOpen)}
              className="p-2 hover:text-[#DC2626] transition-colors"
              aria-label={T.search}
            >
              {searchOpen ? <X className="w-5 h-5" /> : <Search className="w-5 h-5" />}
            </button>
            <div className="flex items-center gap-2 bg-[#DC2626] text-white px-3 py-2">
              <Radio className="w-4 h-4 animate-pulse" />
              <span className="cat-tag">{T.liveTv}</span>
            </div>
            <Link
              to="/admin/login"
              data-testid="header-admin-link"
              className="border border-[#1E3A8A] text-[#1E3A8A] px-4 py-2 cat-tag hover:bg-[#1E3A8A] hover:text-white transition-colors"
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
                className="flex-1 px-3 py-2 border border-[#E2E8F0] focus:outline-none focus:border-[#DC2626]"
              />
              <button type="submit" data-testid="search-submit"
                className="bg-[#DC2626] hover:bg-[#B91C1C] transition-colors text-white px-4 py-2 cat-tag flex items-center gap-2">
                <Search className="w-4 h-4" /> {T.search}
              </button>
            </form>
          </div>
        )}
      </div>

      {/* Category nav */}
      <nav className="bg-[#1E3A8A] text-white sticky top-0 z-40 shadow-sm" data-testid="category-nav">
        <div className="max-w-7xl mx-auto px-4">
          <div className="hidden md:flex items-center gap-1 overflow-x-auto">
            <NavLink
              to="/"
              end
              data-testid="nav-home-link"
              className={({ isActive }) =>
                `px-4 py-3 cat-tag whitespace-nowrap transition-colors ${isActive ? "bg-[#DC2626]" : "hover:bg-[#1e2a6a]"}`
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
                  `px-4 py-3 cat-tag whitespace-nowrap transition-colors ${isActive ? "bg-[#DC2626]" : "hover:bg-[#1e2a6a]"}`
                }
              >
                {c.name_te}
              </NavLink>
            ))}
          </div>
          {mobileOpen && (
            <div className="md:hidden flex flex-col py-2" data-testid="mobile-nav">
              <form onSubmit={submitSearch} className="flex gap-2 px-4 py-2">
                <input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder={T.searchPlaceholder}
                  className="flex-1 px-2 py-1 text-black text-sm"
                />
                <button type="submit" className="bg-[#DC2626] px-3 py-1 cat-tag text-xs"><Search className="w-4 h-4"/></button>
              </form>
              <NavLink to="/" end onClick={() => setMobileOpen(false)} className="px-4 py-2 cat-tag">{T.home}</NavLink>
              {cats.map((c) => (
                <NavLink
                  key={c.slug}
                  to={`/category/${c.slug}`}
                  onClick={() => setMobileOpen(false)}
                  className="px-4 py-2 cat-tag"
                >
                  {c.name_te}
                </NavLink>
              ))}
              <Link to="/admin/login" onClick={() => setMobileOpen(false)} className="px-4 py-2 cat-tag bg-[#DC2626]">{T.admin}</Link>
            </div>
          )}
        </div>
      </nav>
    </header>
  );
}
