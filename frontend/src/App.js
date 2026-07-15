import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import { useEffect, useState } from "react";
import "@/App.css";
import { Toaster } from "sonner";
import { AuthProvider } from "@/contexts/AuthContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import Home from "@/pages/Home";
import Category from "@/pages/Category";
import Article from "@/pages/Article";
import Search from "@/pages/Search";
import LivePage from "@/pages/LivePage";
import StaticPage from "@/pages/StaticPage";
import AdminLogin from "@/pages/AdminLogin";
import AdminDashboard from "@/pages/AdminDashboard";
import AdSlot from "@/components/ads/AdSlot";
import StockTicker from "@/components/widgets/StockTicker";
import RegionBanner from "@/components/geo/RegionBanner";
import { api } from "@/lib/api";

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => { window.scrollTo(0, 0); }, [pathname]);
  return null;
}

function Layout({ children }) {
  const [flash, setFlash] = useState([]);
  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get("/news?flash=true&limit=10");
        setFlash(data.items || []);
      } catch (e) { /* ignore */ }
    })();
  }, []);
  return (
    <div className="min-h-screen flex flex-col bg-[#F5F7FB]">
      <AdSlot placement="strip" testId="ad-strip-top" />
      <Header flash={flash} />
      <StockTicker />
      <RegionBanner onRegionChange={(r) => {
        // Trigger Home page refresh by dispatching custom event
        window.dispatchEvent(new CustomEvent("n9t-region-change", { detail: r }));
      }} />
      <div className="flex-1">{children}</div>
      <Footer />
    </div>
  );
}

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <BrowserRouter>
          <ScrollToTop />
          <Toaster position="top-right" richColors />
          <Routes>
            <Route path="/admin/login" element={<Layout><AdminLogin /></Layout>} />
            <Route path="/admin" element={<Layout><AdminDashboard /></Layout>} />
            <Route path="/" element={<Layout><Home /></Layout>} />
            <Route path="/category/:slug" element={<Layout><Category /></Layout>} />
            <Route path="/article/:id" element={<Layout><Article /></Layout>} />
            <Route path="/search" element={<Layout><Search /></Layout>} />
            <Route path="/live" element={<Layout><LivePage /></Layout>} />
            <Route path="/privacy" element={<Layout><StaticPage /></Layout>} />
            <Route path="/terms" element={<Layout><StaticPage /></Layout>} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
