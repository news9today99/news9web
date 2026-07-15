import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import { useEffect, useState } from "react";
import "@/App.css";
import { Toaster } from "sonner";
import { AuthProvider } from "@/contexts/AuthContext";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import Home from "@/pages/Home";
import Category from "@/pages/Category";
import Article from "@/pages/Article";
import AdminLogin from "@/pages/AdminLogin";
import AdminDashboard from "@/pages/AdminDashboard";
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
        const { data } = await api.get("/news?featured=true&limit=5");
        setFlash(data);
      } catch (e) { /* ignore */ }
    })();
  }, []);
  return (
    <div className="min-h-screen flex flex-col bg-[#F8F9FA]">
      <Header flash={flash} />
      <div className="flex-1">{children}</div>
      <Footer />
    </div>
  );
}

function App() {
  return (
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
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
