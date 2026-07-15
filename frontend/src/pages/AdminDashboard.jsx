import { useEffect, useRef, useState } from "react";
import { Navigate, Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { api, resolveImageUrl, formatDate } from "@/lib/api";
import { toast } from "sonner";
import { Plus, Trash2, Edit3, Upload, LogOut, X, Save, Radio } from "lucide-react";
import RichTextEditor from "@/components/editor/RichTextEditor";
import LivePlayer from "@/components/livetv/LivePlayer";
import { T } from "@/lib/i18n";

const EMPTY = {
  title: "", summary: "", body: "", category: "",
  image_url: "", images: [], youtube_url: "",
  is_featured: false, is_flash: false, is_published: true, tags: "",
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
      setItems(n.data);
      setCats(c.data);
      setForm(f => ({ ...f, category: f.category || c.data[0]?.slug || "" }));
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
      is_flash: item.is_flash || false,
      is_published: item.is_published, tags: (item.tags || []).join(", "),
    });
    setShowForm(true);
  };

  const doUpload = async (file) => {
    const fd = new FormData();
    fd.append("file", file);
    const { data } = await api.post("/admin/upload", fd, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return data.url;
  };

  const handleUploadCover = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const url = await doUpload(file);
      setForm(f => ({ ...f, image_url: url }));
      toast.success("అప్‌లోడ్ అయింది");
    } catch (err) {
      toast.error(err.response?.data?.detail || "Upload failed");
    } finally { setUploading(false); e.target.value = ""; }
  };

  const handleUploadGallery = async (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    setUploadingGallery(true);
    try {
      const urls = await Promise.all(files.map(doUpload));
      setForm(f => ({ ...f, images: [...(f.images || []), ...urls] }));
      toast.success(`${urls.length} చిత్రాలు అప్‌లోడ్ అయ్యాయి`);
    } catch (err) {
      toast.error("Upload failed");
    } finally { setUploadingGallery(false); e.target.value = ""; }
  };

  const removeGalleryImage = (i) => {
    setForm(f => ({ ...f, images: f.images.filter((_, idx) => idx !== i) }));
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
        toast.success("వార్త అప్‌డేట్ అయింది");
      } else {
        await api.post("/admin/news", payload);
        toast.success("వార్త ప్రచురించబడింది");
      }
      setShowForm(false);
      loadAll();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Save failed");
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm(T.confirmDelete)) return;
    try {
      await api.delete(`/admin/news/${id}`);
      toast.success("తొలగించబడింది");
      loadAll();
    } catch { toast.error("Delete failed"); }
  };

  const catLabel = (slug) => cats.find(c => c.slug === slug)?.name_te || slug;

  return (
    <main className="max-w-7xl mx-auto px-4 py-8" data-testid="admin-dashboard">
      <div className="flex items-center justify-between border-b-2 border-[#DC2626] pb-3 mb-6 flex-wrap gap-3">
        <div>
          <div className="cat-tag text-[#DC2626]">{T.admin}</div>
          <h1 className="font-serif-editorial font-black text-3xl">{T.newsroomDashboard}</h1>
          <p className="text-sm text-[#475569]">{T.signedInAs}: {user.email}</p>
        </div>
        <button onClick={logout} data-testid="admin-logout-btn"
          className="border border-[#0F172A] px-4 py-2 cat-tag flex items-center gap-2 hover:bg-[#0F172A] hover:text-white transition-colors">
          <LogOut className="w-4 h-4" /> {T.logout}
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-[#E2E8F0] mb-6" data-testid="admin-tabs">
        {[
          { k: "articles", label: T.articles },
          { k: "categories", label: T.categories },
          { k: "livetv", label: T.liveTvSettings },
        ].map(t => (
          <button key={t.k} onClick={() => setTab(t.k)} data-testid={`tab-${t.k}`}
            className={`px-4 py-3 cat-tag border-b-2 transition-colors ${tab === t.k ? "border-[#DC2626] text-[#DC2626]" : "border-transparent hover:text-[#DC2626]"}`}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === "articles" && (
        <ArticlesTab items={items} loading={loading} openCreate={openCreate} openEdit={openEdit}
                     handleDelete={handleDelete} catLabel={catLabel} />
      )}
      {tab === "categories" && (
        <CategoriesTab cats={cats} onChanged={loadAll} />
      )}
      {tab === "livetv" && (
        <LiveTVTab />
      )}

      {showForm && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" data-testid="admin-form-modal">
          <div className="bg-white w-full max-w-3xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#E2E8F0] bg-[#1E3A8A] text-white">
              <h2 className="font-serif-editorial font-bold text-xl">{editing ? T.editArticle : T.createArticle}</h2>
              <button onClick={() => setShowForm(false)} data-testid="admin-form-close"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="cat-tag block mb-1">{T.titleRequired}</label>
                <input required value={form.title} onChange={e => setForm({...form, title: e.target.value})}
                  data-testid="form-title" className="w-full px-3 py-2 border border-[#E2E8F0] focus:outline-none focus:border-[#DC2626]"/>
              </div>
              <div>
                <label className="cat-tag block mb-1">{T.summary}</label>
                <input value={form.summary} onChange={e => setForm({...form, summary: e.target.value})}
                  data-testid="form-summary" className="w-full px-3 py-2 border border-[#E2E8F0] focus:outline-none focus:border-[#DC2626]"/>
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
                    data-testid="form-tags" className="w-full px-3 py-2 border border-[#E2E8F0] focus:outline-none focus:border-[#DC2626]"/>
                </div>
              </div>
              <div>
                <label className="cat-tag block mb-1">{T.body}</label>
                <RichTextEditor value={form.body} onChange={(v) => setForm({...form, body: v})} testId="form-body-editor" />
              </div>
              <div>
                <label className="cat-tag block mb-1">{T.coverImage}</label>
                <div className="flex gap-2">
                  <input value={form.image_url} onChange={e => setForm({...form, image_url: e.target.value})}
                    placeholder={T.pasteUrlOrUpload} data-testid="form-image-url"
                    className="flex-1 px-3 py-2 border border-[#E2E8F0] focus:outline-none focus:border-[#DC2626]"/>
                  <input ref={fileInputRef} type="file" accept="image/*" hidden onChange={handleUploadCover} data-testid="form-image-file"/>
                  <button type="button" onClick={() => fileInputRef.current?.click()} disabled={uploading}
                    data-testid="form-upload-btn"
                    className="bg-[#1E3A8A] hover:bg-[#152a63] transition-colors text-white px-4 py-2 cat-tag flex items-center gap-2">
                    <Upload className="w-4 h-4" /> {uploading ? T.uploading : T.upload}
                  </button>
                </div>
                {form.image_url && (
                  <div className="mt-2 relative inline-block">
                    <img src={resolveImageUrl(form.image_url)} alt="preview" className="max-h-40 border border-[#E2E8F0]" />
                  </div>
                )}
              </div>
              <div>
                <label className="cat-tag block mb-1">{T.additionalImages}</label>
                <input ref={galleryInputRef} type="file" accept="image/*" multiple hidden onChange={handleUploadGallery} data-testid="form-gallery-file"/>
                <button type="button" onClick={() => galleryInputRef.current?.click()} disabled={uploadingGallery}
                  data-testid="form-gallery-btn"
                  className="border border-[#1E3A8A] text-[#1E3A8A] hover:bg-[#1E3A8A] hover:text-white transition-colors px-4 py-2 cat-tag flex items-center gap-2">
                  <Plus className="w-4 h-4" /> {uploadingGallery ? T.uploading : T.addImage}
                </button>
                {form.images && form.images.length > 0 && (
                  <div className="mt-2 grid grid-cols-4 gap-2">
                    {form.images.map((src, i) => (
                      <div key={i} className="relative group aspect-square">
                        <img src={resolveImageUrl(src)} alt="" className="w-full h-full object-cover border border-[#E2E8F0]" />
                        <button type="button" onClick={() => removeGalleryImage(i)}
                          data-testid={`gallery-remove-${i}`}
                          className="absolute top-1 right-1 bg-black/70 text-white p-1 hover:bg-[#DC2626] transition-colors">
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
                  data-testid="form-youtube" className="w-full px-3 py-2 border border-[#E2E8F0] focus:outline-none focus:border-[#DC2626]"/>
              </div>
              <div className="flex gap-6 flex-wrap">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={form.is_featured} onChange={e => setForm({...form, is_featured: e.target.checked})}
                    data-testid="form-featured"/>
                  <span className="cat-tag">{T.featured}</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={form.is_flash} onChange={e => setForm({...form, is_flash: e.target.checked})}
                    data-testid="form-flash"/>
                  <span className="cat-tag text-[#DC2626]">{T.flashNewsToggle}</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={form.is_published} onChange={e => setForm({...form, is_published: e.target.checked})}
                    data-testid="form-published"/>
                  <span className="cat-tag">{T.published}</span>
                </label>
              </div>
              <div className="flex gap-2 pt-4 border-t border-[#E2E8F0]">
                <button type="submit" data-testid="form-submit"
                  className="bg-[#DC2626] hover:bg-[#B91C1C] transition-colors text-white px-6 py-2 cat-tag">
                  {editing ? T.update : T.publish}
                </button>
                <button type="button" onClick={() => setShowForm(false)} data-testid="form-cancel"
                  className="border border-[#E2E8F0] px-6 py-2 cat-tag hover:bg-slate-50">
                  {T.cancel}
                </button>
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
          className="bg-[#DC2626] hover:bg-[#B91C1C] transition-colors text-white px-4 py-2 cat-tag flex items-center gap-2">
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
        {loading ? (
          <div className="p-8 text-center text-[#475569]">{T.loading}</div>
        ) : items.length === 0 ? (
          <div className="p-8 text-center text-[#475569]" data-testid="admin-empty">{T.noArticlesYet}</div>
        ) : items.map((item, i) => (
          <div key={item.id} className="grid grid-cols-12 px-4 py-3 border-b border-[#E2E8F0] items-center hover:bg-slate-50" data-testid={`admin-row-${i}`}>
            <div className="col-span-6 font-medium">
              <Link to={`/article/${item.id}`} target="_blank" className="hover:text-[#DC2626]">{item.title}</Link>
              {item.is_flash && <span className="ml-2 cat-tag bg-[#DC2626] text-white px-1 text-[0.6rem]">⚡ FLASH</span>}
            </div>
            <div className="col-span-2 cat-tag text-[#DC2626]">{catLabel(item.category)}</div>
            <div className="col-span-2 text-sm">{formatDate(item.created_at)}</div>
            <div className="col-span-1">
              <span className={`cat-tag px-2 py-1 ${item.is_published ? "bg-green-100 text-green-800" : "bg-slate-100"}`}>
                {item.is_published ? T.live : T.draft}
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
    </>
  );
}

function CategoriesTab({ cats, onChanged }) {
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ slug: "", name_en: "", name_te: "", order: 100 });
  const [saving, setSaving] = useState(false);

  const reset = () => { setEditing(null); setForm({ slug: "", name_en: "", name_te: "", order: 100 }); };

  const startEdit = (c) => { setEditing(c.slug); setForm(c); };

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (editing) {
        await api.put(`/admin/categories/${editing}`, {
          name_en: form.name_en, name_te: form.name_te, order: Number(form.order),
        });
        toast.success("విభాగం అప్‌డేట్ అయింది");
      } else {
        await api.post("/admin/categories", {
          slug: form.slug, name_en: form.name_en, name_te: form.name_te, order: Number(form.order),
        });
        toast.success("విభాగం జోడించబడింది");
      }
      reset();
      onChanged();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Save failed");
    } finally { setSaving(false); }
  };

  const del = async (slug) => {
    if (!window.confirm(`Delete category ${slug}?`)) return;
    try {
      await api.delete(`/admin/categories/${slug}`);
      toast.success("తొలగించబడింది");
      onChanged();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Delete failed");
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6" data-testid="categories-tab">
      <div className="lg:col-span-2 bg-white border border-[#E2E8F0]">
        <div className="grid grid-cols-12 cat-tag bg-slate-100 px-4 py-3 border-b border-[#E2E8F0]">
          <div className="col-span-3">{T.slug}</div>
          <div className="col-span-3">{T.nameEnglish}</div>
          <div className="col-span-3">{T.nameTelugu}</div>
          <div className="col-span-1">{T.order}</div>
          <div className="col-span-2 text-right">{T.actions}</div>
        </div>
        {cats.map((c, i) => (
          <div key={c.slug} className="grid grid-cols-12 px-4 py-3 border-b border-[#E2E8F0] items-center hover:bg-slate-50" data-testid={`cat-row-${i}`}>
            <div className="col-span-3 font-mono text-sm">{c.slug}</div>
            <div className="col-span-3">{c.name_en}</div>
            <div className="col-span-3 font-serif-editorial">{c.name_te}</div>
            <div className="col-span-1">{c.order}</div>
            <div className="col-span-2 flex gap-2 justify-end">
              <button onClick={() => startEdit(c)} data-testid={`cat-edit-${i}`} className="p-1 hover:text-[#DC2626]"><Edit3 className="w-4 h-4"/></button>
              <button onClick={() => del(c.slug)} data-testid={`cat-delete-${i}`} className="p-1 hover:text-[#DC2626]"><Trash2 className="w-4 h-4"/></button>
            </div>
          </div>
        ))}
      </div>

      <form onSubmit={submit} className="bg-white border border-[#E2E8F0] p-4 space-y-3" data-testid="category-form">
        <h3 className="font-serif-editorial font-bold text-lg">{editing ? T.editArticle : T.addCategory}</h3>
        <div>
          <label className="cat-tag block mb-1">{T.slug}</label>
          <input required disabled={!!editing} value={form.slug}
            onChange={e => setForm({...form, slug: e.target.value})}
            placeholder="e.g. weather"
            data-testid="cat-form-slug"
            className="w-full px-3 py-2 border border-[#E2E8F0] disabled:bg-slate-100 focus:outline-none focus:border-[#DC2626]"/>
        </div>
        <div>
          <label className="cat-tag block mb-1">{T.nameEnglish}</label>
          <input required value={form.name_en} onChange={e => setForm({...form, name_en: e.target.value})}
            data-testid="cat-form-name-en"
            className="w-full px-3 py-2 border border-[#E2E8F0] focus:outline-none focus:border-[#DC2626]"/>
        </div>
        <div>
          <label className="cat-tag block mb-1">{T.nameTelugu}</label>
          <input required value={form.name_te} onChange={e => setForm({...form, name_te: e.target.value})}
            data-testid="cat-form-name-te"
            className="w-full px-3 py-2 border border-[#E2E8F0] focus:outline-none focus:border-[#DC2626] font-serif-editorial"/>
        </div>
        <div>
          <label className="cat-tag block mb-1">{T.order}</label>
          <input type="number" value={form.order} onChange={e => setForm({...form, order: e.target.value})}
            data-testid="cat-form-order"
            className="w-full px-3 py-2 border border-[#E2E8F0] focus:outline-none focus:border-[#DC2626]"/>
        </div>
        <div className="flex gap-2 pt-2">
          <button type="submit" disabled={saving} data-testid="cat-form-submit"
            className="bg-[#DC2626] hover:bg-[#B91C1C] transition-colors text-white px-4 py-2 cat-tag disabled:opacity-60">
            {saving ? "..." : T.save}
          </button>
          {editing && (
            <button type="button" onClick={reset} data-testid="cat-form-cancel"
              className="border border-[#E2E8F0] px-4 py-2 cat-tag hover:bg-slate-50">
              {T.cancel}
            </button>
          )}
        </div>
      </form>
    </div>
  );
}

function LiveTVTab() {
  const [form, setForm] = useState({ url: "", stream_type: "youtube", title_en: "", title_te: "" });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await api.get("/settings/livetv");
      setForm(data);
      setLoading(false);
    })();
  }, []);

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.put("/admin/settings/livetv", form);
      toast.success("లైవ్ టీవీ సెట్టింగ్‌లు సేవ్ అయ్యాయి");
    } catch { toast.error("Save failed"); }
    finally { setSaving(false); }
  };

  if (loading) return <div>{T.loading}</div>;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6" data-testid="livetv-tab">
      <form onSubmit={submit} className="bg-white border border-[#E2E8F0] p-6 space-y-4">
        <h3 className="font-serif-editorial font-bold text-lg flex items-center gap-2">
          <Radio className="w-5 h-5 text-[#DC2626]" /> {T.liveTvSettings}
        </h3>
        <p className="text-xs text-[#475569] leading-relaxed border-l-2 border-[#DC2626] pl-3">
          {T.liveTvHelp}
        </p>
        <div>
          <label className="cat-tag block mb-1">{T.streamType}</label>
          <select value={form.stream_type} onChange={e => setForm({...form, stream_type: e.target.value})}
            data-testid="livetv-type"
            className="w-full px-3 py-2 border border-[#E2E8F0] bg-white">
            <option value="youtube">{T.streamTypeYoutube}</option>
            <option value="hls">{T.streamTypeHls}</option>
            <option value="mp4">{T.streamTypeMp4}</option>
          </select>
        </div>
        <div>
          <label className="cat-tag block mb-1">{T.streamUrl}</label>
          <input required value={form.url} onChange={e => setForm({...form, url: e.target.value})}
            placeholder={form.stream_type === "youtube" ? "https://www.youtube.com/embed/VIDEO_ID" :
                         form.stream_type === "hls" ? "https://example.com/stream.m3u8" :
                         "https://example.com/stream.mp4"}
            data-testid="livetv-url"
            className="w-full px-3 py-2 border border-[#E2E8F0] focus:outline-none focus:border-[#DC2626] font-mono text-sm"/>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="cat-tag block mb-1">{T.channelTitleEn}</label>
            <input value={form.title_en || ""} onChange={e => setForm({...form, title_en: e.target.value})}
              data-testid="livetv-title-en"
              className="w-full px-3 py-2 border border-[#E2E8F0] focus:outline-none focus:border-[#DC2626]"/>
          </div>
          <div>
            <label className="cat-tag block mb-1">{T.channelTitleTe}</label>
            <input value={form.title_te || ""} onChange={e => setForm({...form, title_te: e.target.value})}
              data-testid="livetv-title-te"
              className="w-full px-3 py-2 border border-[#E2E8F0] focus:outline-none focus:border-[#DC2626] font-serif-editorial"/>
          </div>
        </div>
        <button type="submit" disabled={saving} data-testid="livetv-save"
          className="bg-[#DC2626] hover:bg-[#B91C1C] transition-colors text-white px-4 py-2 cat-tag flex items-center gap-2">
          <Save className="w-4 h-4" /> {saving ? T.uploading : T.saveSettings}
        </button>
      </form>

      <div className="bg-white border border-[#E2E8F0] p-6">
        <h3 className="font-serif-editorial font-bold text-lg mb-3">Preview</h3>
        {form.url && <LiveTVPreview form={form} />}
      </div>
    </div>
  );
}

function LiveTVPreview({ form }) {
  return (
    <div>
      <LivePlayer url={form.url} streamType={form.stream_type} titleEn={form.title_en} titleTe={form.title_te} />
      <div className="mt-3">
        <div className="cat-tag text-[#DC2626]">{T.onAir}</div>
        <div className="font-serif-editorial font-bold">{form.title_te}</div>
      </div>
    </div>
  );
}
