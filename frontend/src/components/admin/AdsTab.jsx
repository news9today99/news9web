import { useEffect, useRef, useState } from "react";
import { api, resolveImageUrl } from "@/lib/api";
import { toast } from "sonner";
import { Plus, Trash2, Edit3, X, Upload } from "lucide-react";
import { T } from "@/lib/i18n";

const PLACEMENTS = [
  { value: "strip", label: "టాప్ స్ట్రిప్" },
  { value: "sidebar", label: "సైడ్‌బార్" },
  { value: "image", label: "సైడ్‌బార్ చిత్రం" },
  { value: "video", label: "వ్యాసంలో వీడియో" },
];

const EMPTY = { name: "", placement: "strip", image_url: "", video_url: "", link_url: "", is_active: true, order: 100 };

export default function AdsTab() {
  const [ads, setAds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef(null);

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/admin/ads");
      setAds(data);
    } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const openCreate = () => { setEditing(null); setForm(EMPTY); setShowForm(true); };
  const openEdit = (ad) => {
    setEditing(ad);
    setForm({
      name: ad.name, placement: ad.placement,
      image_url: ad.image_url || "", video_url: ad.video_url || "",
      link_url: ad.link_url || "", is_active: ad.is_active, order: ad.order,
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
      const { data } = await api.post("/admin/upload", fd, { headers: { "Content-Type": "multipart/form-data" } });
      setForm(f => ({ ...f, image_url: data.url }));
      toast.success("అప్‌లోడ్ అయింది");
    } catch { toast.error("Upload failed"); }
    finally { setUploading(false); e.target.value = ""; }
  };

  const submit = async (e) => {
    e.preventDefault();
    try {
      if (editing) {
        await api.put(`/admin/ads/${editing.id}`, form);
        toast.success("ప్రకటన అప్‌డేట్ అయింది");
      } else {
        await api.post("/admin/ads", form);
        toast.success("ప్రకటన జోడించబడింది");
      }
      setShowForm(false); load();
    } catch (err) { toast.error(err.response?.data?.detail || "Save failed"); }
  };

  const toggleActive = async (ad) => {
    try {
      await api.put(`/admin/ads/${ad.id}`, { is_active: !ad.is_active });
      load();
    } catch { toast.error("Update failed"); }
  };

  const del = async (id) => {
    if (!window.confirm("Delete this ad?")) return;
    try {
      await api.delete(`/admin/ads/${id}`);
      toast.success("తొలగించబడింది");
      load();
    } catch { toast.error("Delete failed"); }
  };

  return (
    <div data-testid="ads-tab">
      <div className="flex justify-end mb-4">
        <button onClick={openCreate} data-testid="ad-new-btn"
          className="bg-brand-red hover:bg-brand-red transition-colors text-white px-4 py-2 cat-tag flex items-center gap-2">
          <Plus className="w-4 h-4" /> {T.addAd}
        </button>
      </div>

      <div className="bg-white border border-[#E2E8F0]">
        <div className="grid grid-cols-12 cat-tag bg-slate-100 px-4 py-3 border-b border-[#E2E8F0]">
          <div className="col-span-3">{T.adName}</div>
          <div className="col-span-2">{T.placement}</div>
          <div className="col-span-3">Preview</div>
          <div className="col-span-2">{T.linkUrl}</div>
          <div className="col-span-1">{T.active}</div>
          <div className="col-span-1 text-right">{T.actions}</div>
        </div>
        {loading ? <div className="p-6 text-center">{T.loading}</div> :
         ads.length === 0 ? <div className="p-6 text-center text-[#475569]" data-testid="ads-empty">ఇంకా ప్రకటనలు లేవు.</div> :
         ads.map((ad, i) => (
          <div key={ad.id} className="grid grid-cols-12 px-4 py-3 border-b border-[#E2E8F0] items-center hover:bg-slate-50" data-testid={`ad-row-${i}`}>
            <div className="col-span-3 font-medium">{ad.name}</div>
            <div className="col-span-2 cat-tag text-brand-red">{ad.placement}</div>
            <div className="col-span-3">
              {ad.image_url && <img src={resolveImageUrl(ad.image_url)} alt="" className="h-10 object-contain" />}
              {ad.video_url && <span className="text-xs">Video</span>}
            </div>
            <div className="col-span-2 text-xs text-[#475569] truncate">{ad.link_url}</div>
            <div className="col-span-1">
              <label className="cursor-pointer">
                <input type="checkbox" checked={ad.is_active} onChange={() => toggleActive(ad)} data-testid={`ad-toggle-${i}`}/>
              </label>
            </div>
            <div className="col-span-1 flex gap-1 justify-end">
              <button onClick={() => openEdit(ad)} data-testid={`ad-edit-${i}`} className="p-1 hover:text-brand-red"><Edit3 className="w-4 h-4"/></button>
              <button onClick={() => del(ad.id)} data-testid={`ad-delete-${i}`} className="p-1 hover:text-brand-red"><Trash2 className="w-4 h-4"/></button>
            </div>
          </div>
        ))}
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" data-testid="ad-form-modal">
          <div className="bg-white w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#E2E8F0] bg-brand-blue text-white">
              <h2 className="font-serif-editorial font-bold text-xl">{editing ? T.edit : T.addAd}</h2>
              <button onClick={() => setShowForm(false)} data-testid="ad-form-close"><X className="w-5 h-5"/></button>
            </div>
            <form onSubmit={submit} className="p-6 space-y-4">
              <div>
                <label className="cat-tag block mb-1">{T.adName}</label>
                <input required value={form.name} onChange={e => setForm({...form, name: e.target.value})}
                  data-testid="ad-form-name" className="w-full px-3 py-2 border border-[#E2E8F0] focus:outline-none focus:border-brand-red"/>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="cat-tag block mb-1">{T.placement}</label>
                  <select value={form.placement} onChange={e => setForm({...form, placement: e.target.value})}
                    data-testid="ad-form-placement"
                    className="w-full px-3 py-2 border border-[#E2E8F0] bg-white">
                    {PLACEMENTS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="cat-tag block mb-1">{T.order}</label>
                  <input type="number" value={form.order} onChange={e => setForm({...form, order: Number(e.target.value)})}
                    data-testid="ad-form-order"
                    className="w-full px-3 py-2 border border-[#E2E8F0]"/>
                </div>
              </div>
              <div>
                <label className="cat-tag block mb-1">{T.imageUrl}</label>
                <div className="flex gap-2">
                  <input value={form.image_url} onChange={e => setForm({...form, image_url: e.target.value})}
                    placeholder="URL పేస్ట్ / అప్‌లోడ్"
                    data-testid="ad-form-image"
                    className="flex-1 px-3 py-2 border border-[#E2E8F0] focus:outline-none focus:border-brand-red"/>
                  <input ref={fileInputRef} type="file" accept="image/*" hidden onChange={handleUpload} data-testid="ad-form-image-file"/>
                  <button type="button" onClick={() => fileInputRef.current?.click()} disabled={uploading}
                    data-testid="ad-form-upload"
                    className="bg-brand-blue hover:bg-brand-blue text-white px-4 py-2 cat-tag flex items-center gap-2">
                    <Upload className="w-4 h-4"/> {uploading ? T.uploading : T.upload}
                  </button>
                </div>
                {form.image_url && <img src={resolveImageUrl(form.image_url)} alt="" className="mt-2 max-h-32 border border-[#E2E8F0]" />}
              </div>
              <div>
                <label className="cat-tag block mb-1">{T.videoUrl} (optional)</label>
                <input value={form.video_url} onChange={e => setForm({...form, video_url: e.target.value})}
                  placeholder="https://.../ad.mp4"
                  data-testid="ad-form-video"
                  className="w-full px-3 py-2 border border-[#E2E8F0] focus:outline-none focus:border-brand-red"/>
              </div>
              <div>
                <label className="cat-tag block mb-1">{T.linkUrl}</label>
                <input value={form.link_url} onChange={e => setForm({...form, link_url: e.target.value})}
                  placeholder="https://sponsor.com"
                  data-testid="ad-form-link"
                  className="w-full px-3 py-2 border border-[#E2E8F0] focus:outline-none focus:border-brand-red"/>
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={form.is_active} onChange={e => setForm({...form, is_active: e.target.checked})}
                  data-testid="ad-form-active"/>
                <span className="cat-tag">{T.active}</span>
              </label>
              <div className="flex gap-2 pt-4 border-t border-[#E2E8F0]">
                <button type="submit" data-testid="ad-form-submit"
                  className="bg-brand-red hover:bg-brand-red text-white px-6 py-2 cat-tag">{editing ? T.update : T.save}</button>
                <button type="button" onClick={() => setShowForm(false)} data-testid="ad-form-cancel"
                  className="border border-[#E2E8F0] px-6 py-2 cat-tag hover:bg-slate-50">{T.cancel}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
