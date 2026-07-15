import { useEffect, useRef, useState } from "react";
import { Navigate, Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { api, resolveImageUrl, formatDate } from "@/lib/api";
import { toast } from "sonner";
import { Plus, Trash2, Edit3, Upload, LogOut, X } from "lucide-react";
import RichTextEditor from "@/components/editor/RichTextEditor";
import { T } from "@/lib/i18n";
import { TELUGU_FONTS, getFontClass } from "@/lib/fonts";
import CategoriesTab from "@/components/admin/CategoriesTab";
import LiveTVTab from "@/components/admin/LiveTVTab";
import YoutubeTab from "@/components/admin/YoutubeTab";
import AdsTab from "@/components/admin/AdsTab";
import PagesTab from "@/components/admin/PagesTab";
import ContactTab from "@/components/admin/ContactTab";

const EMPTY = {
  title: "", summary: "", body: "", category: "",
  image_url: "", images: [], youtube_url: "",
  is_featured: false, is_flash: false, is_published: true, tags: "",
  body_font: "",
};

export default function AdminDashboard() {
  const { user, loading: authLoading, logout } = useAuth();
  const [tab, setTab] = useState("articles");
  const [items, setItems] = useState([]);
  const [cats, setCats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [uploading, setUploading] = useState(false);
  const [uploadingGallery, setUploadingGallery] = useState(false);
  const fileInputRef = useRef(null);
  const galleryInputRef = useRef(null);

  useEffect(() => {
    if (user && user.role === "admin") loadAll();
  }, [user]);

  const loadAll = async () => {
    setLoading(true);
    try {
      const [n, c] = await Promise.all([api.get("/admin/news"), api.get("/categories")]);
      setItems(n.data); setCats(c.data);
    } catch { toast.error("Load failed"); }
    finally { setLoading(false); }
  };

  if (authLoading) return <div className="p-8">{T.loading}</div>;
  if (!user || user.role !== "admin") return <Navigate to="/admin/login" replace />;

  const openCreate = () => { setEditing(null); setForm({ ...EMPTY, category: cats[0]?.slug || "" }); setShowForm(true); };
  const openEdit = (item) => {
    setEditing(item);
    setForm({
      title: item.title, summary: item.summary || "", body: item.body,
      category: item.category, image_url: item.image_url || "",
      images: item.images || [],
      youtube_url: item.youtube_url || "", is_featured: item.is_featured,
      is_flash: item.is_flash || false, is_published: item.is_published,
      tags: (item.tags || []).join(", "), body_font: item.body_font || "",
    });
    setShowForm(true);
  };

  const doUpload = async (file) => {
    const fd = new FormData(); fd.append("file", file);
    const { data } = await api.post("/admin/upload", fd, { headers: { "Content-Type": "multipart/form-data" } });
    return data.url;
  };

  const handleUploadCover = async (e) => {
    const file = e.target.files?.[0]; if (!file) return;
    setUploading(true);
    try {
      const url = await doUpload(file);
      setForm(f => ({ ...f, image_url: url }));
      toast.success("అప్‌లోడ్ అయింది");
    } catch (err) { toast.error(err.response?.data?.detail || "Upload failed"); }
    finally { setUploading(false); e.target.value = ""; }
  };

  const handleUploadGallery = async (e) => {
    const files = Array.from(e.target.files || []); if (!files.length) return;
    setUploadingGallery(true);
    try {
      const urls = await Promise.all(files.map(doUpload));
      setForm(f => ({ ...f, images: [...(f.images || []), ...urls] }));
      toast.success(`${urls.length} చిత్రాలు అప్‌లోడ్ అయ్యాయి`);
    } catch { toast.error("Upload failed"); }
    finally { setUploadingGallery(false); e.target.value = ""; }
  };

  const removeGalleryImage = (i) => setForm(f => ({ ...f, images: f.images.filter((_, idx) => idx !== i) }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    const payload = { ...form, tags: form.tags.split(",").map(t => t.trim()).filter(Boolean) };
    try {
      if (editing) {
        await api.put(`/admin/news/${editing.id}`, payload);
        toast.success("వార్త అప్‌డేట్ అయింది");
      } else {
        await api.post("/admin/news", payload);
        toast.success("వార్త ప్రచురించబడింది");
      }
      setShowForm(false); loadAll();
    } catch (err) { toast.error(err.response?.data?.detail || "Save failed"); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm(T.confirmDelete)) return;
    try {
      await api.delete(`/admin/news/${id}`);
      toast.success("తొలగించబడింది"); loadAll();
    } catch { toast.error("Delete failed"); }
  };

  const catLabel = (slug) => cats.find(c => c.slug === slug)?.name_te || slug;

  const TABS = [
    { k: "articles", label: T.articles },
    { k: "categories", label: T.categories },
    { k: "ads", label: T.ads },
    { k: "livetv", label: T.liveTvSettings },
    { k: "youtube", label: T.youtubeSync },
    { k: "pages", label: T.pages },
    { k: "contact", label: T.contactSettings },
  ];

  return (
    <main className="max-w-7xl mx-auto px-4 py-8" data-testid="admin-dashboard">
      <div className="flex items-center justify-between border-b-2 border-brand-red pb-3 mb-6 flex-wrap gap-3">
        <div>
          <div className="cat-tag text-brand-red">{T.admin}</div>
          <h1 className="font-serif-editorial font-black text-3xl">{T.newsroomDashboard}</h1>
          <p className="text-sm text-[#475569]">{T.signedInAs}: {user.email}</p>
        </div>
        <button onClick={logout} data-testid="admin-logout-btn"
          className="border border-brand-blue px-4 py-2 cat-tag flex items-center gap-2 hover:bg-brand-blue hover:text-white transition-colors">
          <LogOut className="w-4 h-4" /> {T.logout}
        </button>
      </div>

      <div className="flex gap-1 border-b border-[#E2E8F0] mb-6 overflow-x-auto" data-testid="admin-tabs">
        {TABS.map(t => (
          <button key={t.k} onClick={() => setTab(t.k)} data-testid={`tab-${t.k}`}
            className={`px-4 py-3 cat-tag border-b-2 whitespace-nowrap transition-colors ${tab === t.k ? "border-brand-red text-brand-red" : "border-transparent hover:text-brand-red"}`}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === "articles" && (
        <ArticlesTab items={items} loading={loading} openCreate={openCreate} openEdit={openEdit}
                     handleDelete={handleDelete} catLabel={catLabel} />
      )}
      {tab === "categories" && <CategoriesTab cats={cats} onChanged={loadAll} />}
      {tab === "ads" && <AdsTab />}
      {tab === "livetv" && <LiveTVTab />}
      {tab === "youtube" && <YoutubeTab cats={cats} />}
      {tab === "pages" && <PagesTab />}
      {tab === "contact" && <ContactTab />}

      {showForm && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" data-testid="admin-form-modal">
          <div className="bg-white w-full max-w-3xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#E2E8F0] bg-brand-blue text-white">
              <h2 className="font-serif-editorial font-bold text-xl">{editing ? T.editArticle : T.createArticle}</h2>
              <button onClick={() => setShowForm(false)} data-testid="admin-form-close"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="cat-tag block mb-1">{T.titleRequired}</label>
                <input required value={form.title} onChange={e => setForm({...form, title: e.target.value})}
                  data-testid="form-title" className="w-full px-3 py-2 border border-[#E2E8F0] focus:outline-none focus:border-brand-red"/>
              </div>
              <div>
                <label className="cat-tag block mb-1">{T.summary}</label>
                <input value={form.summary} onChange={e => setForm({...form, summary: e.target.value})}
                  data-testid="form-summary" className="w-full px-3 py-2 border border-[#E2E8F0] focus:outline-none focus:border-brand-red"/>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="cat-tag block mb-1">{T.categoryRequired}</label>
                  <select required value={form.category} onChange={e => setForm({...form, category: e.target.value})}
                    data-testid="form-category" className="w-full px-3 py-2 border border-[#E2E8F0] bg-white">
                    {cats.map(c => <option key={c.slug} value={c.slug}>{c.name_te} ({c.name_en})</option>)}
                  </select>
                </div>
                <div>
                  <label className="cat-tag block mb-1">{T.tags}</label>
                  <input value={form.tags} onChange={e => setForm({...form, tags: e.target.value})}
                    data-testid="form-tags" className="w-full px-3 py-2 border border-[#E2E8F0] focus:outline-none focus:border-brand-red"/>
                </div>
              </div>
              <div>
                <label className="cat-tag block mb-1">{T.bodyFont}</label>
                <select value={form.body_font} onChange={e => setForm({...form, body_font: e.target.value})}
                  data-testid="form-body-font"
                  className={`w-full px-3 py-2 border border-[#E2E8F0] bg-white ${getFontClass(form.body_font)}`}>
                  {TELUGU_FONTS.map(f => (
                    <option key={f.value} value={f.value} className={f.className}>{f.label}</option>
                  ))}
                </select>
                <div className={`mt-2 text-lg p-2 border border-dashed border-[#E2E8F0] ${getFontClass(form.body_font)}`} data-testid="form-body-font-preview">
                  తెలుగు వార్తలు · న్యూస్ 9 టుడే · బ్రేకింగ్ న్యూస్
                </div>
              </div>
              <div>
                <label className="cat-tag block mb-1">{T.body}</label>
                <div className={getFontClass(form.body_font)}>
                  <RichTextEditor value={form.body} onChange={(v) => setForm({...form, body: v})} testId="form-body-editor" />
                </div>
              </div>
              <div>
                <label className="cat-tag block mb-1">{T.coverImage}</label>
                <div className="flex gap-2">
                  <input value={form.image_url} onChange={e => setForm({...form, image_url: e.target.value})}
                    placeholder={T.pasteUrlOrUpload} data-testid="form-image-url"
                    className="flex-1 px-3 py-2 border border-[#E2E8F0] focus:outline-none focus:border-brand-red"/>
                  <input ref={fileInputRef} type="file" accept="image/*" hidden onChange={handleUploadCover} data-testid="form-image-file"/>
                  <button type="button" onClick={() => fileInputRef.current?.click()} disabled={uploading}
                    data-testid="form-upload-btn"
                    className="bg-brand-blue hover:bg-brand-blue transition-colors text-white px-4 py-2 cat-tag flex items-center gap-2">
                    <Upload className="w-4 h-4" /> {uploading ? T.uploading : T.upload}
                  </button>
                </div>
                {form.image_url && <img src={resolveImageUrl(form.image_url)} alt="" className="mt-2 max-h-40 border border-[#E2E8F0]" />}
              </div>
              <div>
                <label className="cat-tag block mb-1">{T.additionalImages}</label>
                <input ref={galleryInputRef} type="file" accept="image/*" multiple hidden onChange={handleUploadGallery} data-testid="form-gallery-file"/>
                <button type="button" onClick={() => galleryInputRef.current?.click()} disabled={uploadingGallery}
                  data-testid="form-gallery-btn"
                  className="border border-brand-blue text-brand-blue hover:bg-brand-blue hover:text-white transition-colors px-4 py-2 cat-tag flex items-center gap-2">
                  <Plus className="w-4 h-4" /> {uploadingGallery ? T.uploading : T.addImage}
                </button>
                {form.images && form.images.length > 0 && (
                  <div className="mt-2 grid grid-cols-4 gap-2">
                    {form.images.map((src, i) => (
                      <div key={i} className="relative group aspect-square">
                        <img src={resolveImageUrl(src)} alt="" className="w-full h-full object-cover border border-[#E2E8F0]" />
                        <button type="button" onClick={() => removeGalleryImage(i)} data-testid={`gallery-remove-${i}`}
                          className="absolute top-1 right-1 bg-black/70 text-white p-1 hover:bg-brand-red transition-colors">
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div>
                <label className="cat-tag block mb-1">{T.youtubeEmbedUrl}</label>
                <input value={form.youtube_url} onChange={e => setForm({...form, youtube_url: e.target.value})}
                  placeholder="https://www.youtube.com/embed/VIDEO_ID"
                  data-testid="form-youtube" className="w-full px-3 py-2 border border-[#E2E8F0] focus:outline-none focus:border-brand-red"/>
              </div>
              <div className="flex gap-6 flex-wrap">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={form.is_featured} onChange={e => setForm({...form, is_featured: e.target.checked})} data-testid="form-featured"/>
                  <span className="cat-tag">{T.featured}</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={form.is_flash} onChange={e => setForm({...form, is_flash: e.target.checked})} data-testid="form-flash"/>
                  <span className="cat-tag text-brand-red">{T.flashNewsToggle}</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={form.is_published} onChange={e => setForm({...form, is_published: e.target.checked})} data-testid="form-published"/>
                  <span className="cat-tag">{T.published}</span>
                </label>
              </div>
              <div className="flex gap-2 pt-4 border-t border-[#E2E8F0]">
                <button type="submit" data-testid="form-submit"
                  className="bg-brand-red hover:bg-brand-red transition-colors text-white px-6 py-2 cat-tag">
                  {editing ? T.update : T.publish}
                </button>
                <button type="button" onClick={() => setShowForm(false)} data-testid="form-cancel"
                  className="border border-[#E2E8F0] px-6 py-2 cat-tag hover:bg-slate-50">{T.cancel}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}

function ArticlesTab({ items, loading, openCreate, openEdit, handleDelete, catLabel }) {
  return (
    <>
      <div className="flex justify-end mb-4">
        <button onClick={openCreate} data-testid="admin-new-article-btn"
          className="bg-brand-red hover:bg-brand-red transition-colors text-white px-4 py-2 cat-tag flex items-center gap-2">
          <Plus className="w-4 h-4" /> {T.newArticle}
        </button>
      </div>
      <div className="bg-white border border-[#E2E8F0]">
        <div className="grid grid-cols-12 cat-tag bg-slate-100 px-4 py-3 border-b border-[#E2E8F0]">
          <div className="col-span-6">{T.title}</div>
          <div className="col-span-2">{T.category}</div>
          <div className="col-span-2">{T.date}</div>
          <div className="col-span-1">{T.status}</div>
          <div className="col-span-1 text-right">{T.actions}</div>
        </div>
        {loading ? <div className="p-8 text-center text-[#475569]">{T.loading}</div> :
         items.length === 0 ? <div className="p-8 text-center text-[#475569]" data-testid="admin-empty">{T.noArticlesYet}</div> :
         items.map((item, i) => (
          <div key={item.id} className="grid grid-cols-12 px-4 py-3 border-b border-[#E2E8F0] items-center hover:bg-slate-50" data-testid={`admin-row-${i}`}>
            <div className="col-span-6 font-medium">
              <Link to={`/article/${item.id}`} target="_blank" className="hover:text-brand-red">{item.title}</Link>
              {item.is_flash && <span className="ml-2 cat-tag bg-brand-red text-white px-1 text-[0.6rem]">⚡ FLASH</span>}
            </div>
            <div className="col-span-2 cat-tag text-brand-red">{catLabel(item.category)}</div>
            <div className="col-span-2 text-sm">{formatDate(item.created_at)}</div>
            <div className="col-span-1">
              <span className={`cat-tag px-2 py-1 ${item.is_published ? "bg-green-100 text-green-800" : "bg-slate-100"}`}>
                {item.is_published ? T.live : T.draft}
              </span>
            </div>
            <div className="col-span-1 flex gap-2 justify-end">
              <button onClick={() => openEdit(item)} data-testid={`admin-edit-${i}`} className="p-1 hover:text-brand-red"><Edit3 className="w-4 h-4" /></button>
              <button onClick={() => handleDelete(item.id)} data-testid={`admin-delete-${i}`} className="p-1 hover:text-brand-red"><Trash2 className="w-4 h-4" /></button>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
