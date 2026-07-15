import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Lock } from "lucide-react";

function formatApiErrorDetail(detail) {
  if (detail == null) return "Something went wrong.";
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) return detail.map(e => e?.msg || JSON.stringify(e)).join(" ");
  return String(detail);
}

export default function AdminLogin() {
  const nav = useNavigate();
  const { login } = useAuth();
  const [email, setEmail] = useState("admin@news.com");
  const [password, setPassword] = useState("admin123");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await login(email, password);
      toast.success("Signed in");
      nav("/admin");
    } catch (err) {
      toast.error(formatApiErrorDetail(err.response?.data?.detail) || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-[70vh] flex items-center justify-center px-4 py-12" data-testid="admin-login-page">
      <div className="w-full max-w-md bg-white border border-[#E2E8F0] p-8 shadow-sm">
        <div className="flex items-center justify-center w-12 h-12 bg-[#DC2626] text-white mx-auto mb-4">
          <Lock className="w-6 h-6" />
        </div>
        <h1 className="font-serif-editorial font-black text-3xl text-center mb-2">Admin Portal</h1>
        <p className="text-center text-sm text-[#475569] mb-6">Sign in to publish news</p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="cat-tag block mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              data-testid="admin-email-input"
              className="w-full px-3 py-2 border border-[#E2E8F0] focus:outline-none focus:border-[#DC2626]"
            />
          </div>
          <div>
            <label className="cat-tag block mb-1">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              data-testid="admin-password-input"
              className="w-full px-3 py-2 border border-[#E2E8F0] focus:outline-none focus:border-[#DC2626]"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            data-testid="admin-login-submit"
            className="w-full bg-[#DC2626] hover:bg-[#B91C1C] disabled:opacity-60 text-white py-3 cat-tag transition-colors"
          >
            {loading ? "Signing in…" : "Sign In"}
          </button>
        </form>
        <div className="mt-4 text-xs text-[#475569] text-center">
          Default credentials pre-filled for demo.
        </div>
      </div>
    </main>
  );
}
