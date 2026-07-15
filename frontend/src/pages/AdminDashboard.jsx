import { useEffect, useRef, useState } from "react";
import { Navigate, Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { api, resolveImageUrl, formatDate } from "@/lib/api";
import { toast } from "sonner";
import { Plus, Trash2, Edit3, Upload, LogOut, ImageIcon, X } from "lucide-react";

const CATEGORIES = ["politics", "sports", "cinema", "business", "technology", "health", "photos", "videos"];

const EMPTY = {
  title: "", summary: "", body: "", category: "politics",
  image_url: "", youtube_url: "", is_featured: false, is_published: true, tags: "",
};

export default function AdminDashboard() {
  const { user, loading: authLoading, logout } = useAuth();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (user && user.role === "admin") loadNews();
  }, [user]);

  const loadNews = async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/admin/news");
      setItems(data);
    } catch (e) {
      toast.error("Failed to load news");
    } finally {
      setLoading(false);
    }
  };

  if (authLoading) return <div className="p-8">Loading…</div>;
  if (!user || user.role !== "admin") return <Navigate to="/admin/login" replace />;

  const openCreate = () => { setEditing(null); setForm(EMPTY); setShowForm(true); };
  const openEdit = (item) => {
    setEditing(item);
    setForm({
      title: item.title, summary: item.summary || "", body: item.body,
      category: item.category, image_url: item.image_url || "",
      youtube_url: item.youtube_url || "", is_featured: item.is_featured,
      is_published: item.is_published, tags: (item.tags || []).join(", "),
    });
    setShowForm(true);
  };

  const handleUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const { data } = await api.post("/admin/upload", fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setForm(f => ({ ...f, image_url: data.url }));
      toast.success("Image uploaded");
    } catch (err) {
      toast.error(err.response?.data?.detail || "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const payload = {
      ...form,
      tags: form.tags.split(",").map(t => t.trim()).filter(Boolean),
    };
    try {
      if (editing) {
        await api.put(`/admin/news/${editing.id}`, payload);
        toast.success("Article updated");
      } else {
        await api.post("/admin/news", payload);
        toast.success("Article published");
      }
      setShowForm(false);
      loadNews();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Save failed");
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Delete this article?")) return;
    try {
      await api.delete(`/admin/news/${id}`);
      toast.success("Deleted");
      loadNews();
    } catch { toast.error("Delete failed"); }
  };

  return (
    <main className="max-w-7xl mx-auto px-4 py-8" data-testid="admin-dashboard">
      <div className="flex items-center justify-between border-b-2 border-[#DC2626] pb-3 mb-6">
        <div>
          <div className="cat-tag text-[#DC2626]">Admin</div>
          <h1 className="font-serif-editorial font-black text-3xl">Newsroom Dashboard</h1>
          <p className="text-sm text-[#475569]">Signed in as {user.email}</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={openCreate}
            data-testid="admin-new-article-btn"
            className="bg-[#DC2626] hover:bg-[#B91C1C] transition-colors text-white px-4 py-2 cat-tag flex items-center gap-2"
          >
            <Plus className="w-4 h-4" /> New Article
          </button>
          <button
            onClick={logout}
            data-testid="admin-logout-btn"
            className="border border-[#0F172A] px-4 py-2 cat-tag flex items-center gap-2 hover:bg-[#0F172A] hover:text-white transition-colors"
          >
            <LogOut className="w-4 h-4" /> Logout
          </button>
        </div>
      </div>

      <div className="bg-white border border-[#E2E8F0]">
        <div className="grid grid-cols-12 cat-tag bg-slate-100 px-4 py-3 border-b border-[#E2E8F0]">
          <div className="col-span-6">Title</div>
          <div className="col-span-2">Category</div>
          <div className="col-span-2">Date</div>
          <div className="col-span-1">Status</div>
          <div className="col-span-1 text-right">Actions</div>
        </div>
        {loading ? (
          <div className="p-8 text-center text-[#475569]">Loading…</div>
        ) : items.length === 0 ? (
          <div className="p-8 text-center text-[#475569]" data-testid="admin-empty">No articles yet. Click New Article.</div>
        ) : items.map((item, i) => (
          <div key={item.id} className="grid grid-cols-12 px-4 py-3 border-b border-[#E2E8F0] items-center hover:bg-slate-50" data-testid={`admin-row-${i}`}>
            <div className="col-span-6 font-medium">
              <Link to={`/article/${item.id}`} target="_blank" className="hover:text-[#DC2626]">{item.title}</Link>
            </div>
            <div className="col-span-2 cat-tag text-[#DC2626]">{item.category}</div>
            <div className="col-span-2 text-sm">{formatDate(item.created_at)}</div>
            <div className="col-span-1">
              <span className={`cat-tag px-2 py-1 ${item.is_published ? "bg-green-100 text-green-800" : "bg-slate-100"}`}>
                {item.is_published ? "Live" : "Draft"}
              </span>
            </div>
            <div className="col-span-1 flex gap-2 justify-end">
              <button onClick={() => openEdit(item)} data-testid={`admin-edit-${i}`} className="p-1 hover:text-[#DC2626]">
                <Edit3 className="w-4 h-4" />
              </button>
              <button onClick={() => handleDelete(item.id)} data-testid={`admin-delete-${i}`} className="p-1 hover:text-[#DC2626]">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" data-testid="admin-form-modal">
          <div className="bg-white w-full max-w-3xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#E2E8F0] bg-[#1E3A8A] text-white">
              <h2 className="font-serif-editorial font-bold text-xl">{editing ? "Edit Article" : "New Article"}</h2>
              <button onClick={() => setShowForm(false)} data-testid="admin-form-close"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="cat-tag block mb-1">Title *</label>
                <input required value={form.title} onChange={e => setForm({...form, title: e.target.value})}
                  data-testid="form-title" className="w-full px-3 py-2 border border-[#E2E8F0] focus:outline-none focus:border-[#DC2626]"/>
              </div>
              <div>
                <label className="cat-tag block mb-1">Summary</label>
                <input value={form.summary} onChange={e => setForm({...form, summary: e.target.value})}
                  data-testid="form-summary" className="w-full px-3 py-2 border border-[#E2E8F0] focus:outline-none focus:border-[#DC2626]"/>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="cat-tag block mb-1">Category *</label>
                  <select value={form.category} onChange={e => setForm({...form, category: e.target.value})}
                    data-testid="form-category" className="w-full px-3 py-2 border border-[#E2E8F0]">
                    {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="cat-tag block mb-1">Tags (comma separated)</label>
                  <input value={form.tags} onChange={e => setForm({...form, tags: e.target.value})}
                    data-testid="form-tags" className="w-full px-3 py-2 border border-[#E2E8F0] focus:outline-none focus:border-[#DC2626]"/>
                </div>
              </div>
              <div>
                <label className="cat-tag block mb-1">Body * (Telugu supported)</label>
                <textarea required rows={8} value={form.body} onChange={e => setForm({...form, body: e.target.value})}
                  data-testid="form-body" className="w-full px-3 py-2 border border-[#E2E8F0] focus:outline-none focus:border-[#DC2626] font-body"/>
              </div>
              <div>
                <label className="cat-tag block mb-1">Cover Image</label>
                <div className="flex gap-2">
                  <input value={form.image_url} onChange={e => setForm({...form, image_url: e.target.value})}
                    placeholder="Paste URL or upload…" data-testid="form-image-url"
                    className="flex-1 px-3 py-2 border border-[#E2E8F0] focus:outline-none focus:border-[#DC2626]"/>
                  <input ref={fileInputRef} type="file" accept="image/*" hidden onChange={handleUpload} data-testid="form-image-file"/>
                  <button type="button" onClick={() => fileInputRef.current?.click()} disabled={uploading}
                    data-testid="form-upload-btn"
                    className="bg-[#1E3A8A] hover:bg-[#152a63] transition-colors text-white px-4 py-2 cat-tag flex items-center gap-2">
                    <Upload className="w-4 h-4" /> {uploading ? "Uploading…" : "Upload"}
                  </button>
                </div>
                {form.image_url && (
                  <div className="mt-2 relative inline-block">
                    <img src={resolveImageUrl(form.image_url)} alt="preview" className="max-h-40 border border-[#E2E8F0]" />
                  </div>
                )}
              </div>
              <div>
                <label className="cat-tag block mb-1">YouTube Embed URL</label>
                <input value={form.youtube_url} onChange={e => setForm({...form, youtube_url: e.target.value})}
                  placeholder="https://www.youtube.com/embed/VIDEO_ID"
                  data-testid="form-youtube" className="w-full px-3 py-2 border border-[#E2E8F0] focus:outline-none focus:border-[#DC2626]"/>
              </div>
              <div className="flex gap-6">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={form.is_featured} onChange={e => setForm({...form, is_featured: e.target.checked})}
                    data-testid="form-featured"/>
                  <span className="cat-tag">Featured (Hero)</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={form.is_published} onChange={e => setForm({...form, is_published: e.target.checked})}
                    data-testid="form-published"/>
                  <span className="cat-tag">Published</span>
                </label>
              </div>
              <div className="flex gap-2 pt-4 border-t border-[#E2E8F0]">
                <button type="submit" data-testid="form-submit"
                  className="bg-[#DC2626] hover:bg-[#B91C1C] transition-colors text-white px-6 py-2 cat-tag">
                  {editing ? "Update" : "Publish"}
                </button>
                <button type="button" onClick={() => setShowForm(false)} data-testid="form-cancel"
                  className="border border-[#E2E8F0] px-6 py-2 cat-tag hover:bg-slate-50">
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}
