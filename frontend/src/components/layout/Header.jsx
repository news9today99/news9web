import { Link, NavLink } from "react-router-dom";
import { Search, Radio, Menu } from "lucide-react";
import Marquee from "react-fast-marquee";
import { useState } from "react";

const CATS = [
  { slug: "politics", name: "Politics" },
  { slug: "sports", name: "Sports" },
  { slug: "cinema", name: "Cinema" },
  { slug: "business", name: "Business" },
  { slug: "technology", name: "Technology" },
  { slug: "health", name: "Health" },
  { slug: "photos", name: "Photos" },
  { slug: "videos", name: "Videos" },
];

export default function Header({ flash = [] }) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <header data-testid="site-header" className="w-full">
      {/* Flash news marquee */}
      <div className="bg-[#DC2626] text-white" data-testid="flash-news-bar">
        <div className="max-w-7xl mx-auto flex items-center gap-3 px-4 py-2">
          <span className="cat-tag bg-white text-[#DC2626] px-2 py-1">Flash News</span>
          <div className="flex-1 overflow-hidden">
            <Marquee pauseOnHover speed={45} gradient={false}>
              {flash.length ? flash.map((f, i) => (
                <Link key={f.id} to={`/article/${f.id}`} className="mx-8 hover:underline">
                  <span className="mr-2 inline-block w-1.5 h-1.5 bg-white align-middle" />
                  {f.title}
                </Link>
              )) : (
                <span className="mx-8">Welcome to Andhra News Portal — Breaking stories, live updates, exclusive coverage.</span>
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
              <div className="font-serif-editorial font-black text-2xl text-[#0F172A] leading-none">Andhra News</div>
              <div className="cat-tag text-[#475569] text-[0.65rem] mt-1">Editorial · Since 2026</div>
            </div>
          </Link>
          <div className="hidden md:flex items-center gap-3">
            <button data-testid="header-search-btn" className="p-2 hover:text-[#DC2626] transition-colors">
              <Search className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2 bg-[#DC2626] text-white px-3 py-2">
              <Radio className="w-4 h-4 animate-pulse" />
              <span className="cat-tag">LIVE TV</span>
            </div>
            <Link
              to="/admin/login"
              data-testid="header-admin-link"
              className="border border-[#1E3A8A] text-[#1E3A8A] px-4 py-2 cat-tag hover:bg-[#1E3A8A] hover:text-white transition-colors"
            >
              Admin
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
      </div>

      {/* Category nav */}
      <nav className="bg-[#1E3A8A] text-white sticky top-0 z-40 shadow-sm" data-testid="category-nav">
        <div className="max-w-7xl mx-auto px-4">
          <div className="hidden md:flex items-center gap-1">
            <NavLink
              to="/"
              end
              data-testid="nav-home-link"
              className={({ isActive }) =>
                `px-4 py-3 cat-tag transition-colors ${isActive ? "bg-[#DC2626]" : "hover:bg-[#1e2a6a]"}`
              }
            >
              Home
            </NavLink>
            {CATS.map((c) => (
              <NavLink
                key={c.slug}
                to={`/category/${c.slug}`}
                data-testid={`nav-${c.slug}-link`}
                className={({ isActive }) =>
                  `px-4 py-3 cat-tag transition-colors ${isActive ? "bg-[#DC2626]" : "hover:bg-[#1e2a6a]"}`
                }
              >
                {c.name}
              </NavLink>
            ))}
          </div>
          {mobileOpen && (
            <div className="md:hidden flex flex-col py-2" data-testid="mobile-nav">
              <NavLink to="/" end onClick={() => setMobileOpen(false)} className="px-4 py-2 cat-tag">Home</NavLink>
              {CATS.map((c) => (
                <NavLink
                  key={c.slug}
                  to={`/category/${c.slug}`}
                  onClick={() => setMobileOpen(false)}
                  className="px-4 py-2 cat-tag"
                >
                  {c.name}
                </NavLink>
              ))}
              <Link to="/admin/login" onClick={() => setMobileOpen(false)} className="px-4 py-2 cat-tag bg-[#DC2626]">Admin</Link>
            </div>
          )}
        </div>
      </nav>
    </header>
  );
}
