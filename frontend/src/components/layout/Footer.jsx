import { Link } from "react-router-dom";

export default function Footer() {
  return (
    <footer data-testid="site-footer" className="mt-16 bg-[#0F172A] text-white">
      <div className="max-w-7xl mx-auto px-4 py-12 grid grid-cols-1 md:grid-cols-4 gap-8">
        <div>
          <div className="font-serif-editorial font-black text-2xl mb-2">ABN Andhra News</div>
          <p className="text-sm text-slate-400 leading-relaxed">
            Trusted editorial coverage. Breaking news, in-depth analysis, and stories that matter.
          </p>
        </div>
        <div>
          <div className="cat-tag text-[#DC2626] mb-3">Sections</div>
          <ul className="space-y-2 text-sm">
            <li><Link to="/category/politics" className="hover:text-[#DC2626] transition-colors">Politics</Link></li>
            <li><Link to="/category/sports" className="hover:text-[#DC2626] transition-colors">Sports</Link></li>
            <li><Link to="/category/cinema" className="hover:text-[#DC2626] transition-colors">Cinema</Link></li>
            <li><Link to="/category/business" className="hover:text-[#DC2626] transition-colors">Business</Link></li>
          </ul>
        </div>
        <div>
          <div className="cat-tag text-[#DC2626] mb-3">More</div>
          <ul className="space-y-2 text-sm">
            <li><Link to="/category/photos" className="hover:text-[#DC2626] transition-colors">Photos</Link></li>
            <li><Link to="/category/videos" className="hover:text-[#DC2626] transition-colors">Videos</Link></li>
            <li><Link to="/category/technology" className="hover:text-[#DC2626] transition-colors">Technology</Link></li>
            <li><Link to="/category/health" className="hover:text-[#DC2626] transition-colors">Health</Link></li>
          </ul>
        </div>
        <div>
          <div className="cat-tag text-[#DC2626] mb-3">Newsletter</div>
          <p className="text-sm text-slate-400 mb-3">Get top stories delivered daily.</p>
          <div className="flex">
            <input
              type="email"
              placeholder="Your email"
              data-testid="footer-newsletter-input"
              className="flex-1 bg-slate-800 text-white px-3 py-2 text-sm border border-slate-700 focus:outline-none focus:border-[#DC2626]"
            />
            <button data-testid="footer-newsletter-btn" className="bg-[#DC2626] hover:bg-[#B91C1C] transition-colors px-4 py-2 cat-tag">
              Subscribe
            </button>
          </div>
        </div>
      </div>
      <div className="border-t border-slate-800">
        <div className="max-w-7xl mx-auto px-4 py-4 text-xs text-slate-500 flex flex-col md:flex-row justify-between gap-2">
          <span>© 2026 ABN Andhra News Portal. All rights reserved.</span>
          <span>Editorial · Independent · Trusted</span>
        </div>
      </div>
    </footer>
  );
}
