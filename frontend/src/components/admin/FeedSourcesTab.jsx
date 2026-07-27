import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { Plus, Trash2, RefreshCw, Facebook, Twitter, Instagram, Youtube, Rss } from "lucide-react";
import { T } from "@/lib/i18n";

const SOURCE_TYPES = [
  { value: "facebook", label: "Facebook Page", Icon: Facebook,
    hint: "Facebook doesn't offer official RSS. Use RSSHub: https://rsshub.app/facebook/page/PAGE_ID" },
  { value: "twitter", label: "Twitter / X", Icon: Twitter,
    hint: "Twitter/X has no free API. Use Nitter RSS: https://nitter.net/USERNAME/rss" },
  { value: "instagram", label: "Instagram", Icon: Instagram,
    hint: "Instagram has no free API. Use RSSHub: https://rsshub.app/instagram/user/USERNAME" },
  { value: "youtube", label: "YouTube Channel", Icon: Youtube,
    hint: "Use: https://www.youtube.com/feeds/videos.xml?channel_id=CHANNEL_ID" },
  { value: "rss", label: "Generic RSS/Atom", Icon: Rss,
    hint: "Any RSS or Atom feed URL" },
];

const EMPTY = { name: "", source_type: "facebook", feed_url: "", category: "", is_active: true };

export default function FeedSourcesTab({ cats }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(EMPTY);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/admin/feed-sources");
      setItems(data);
    } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);
  useEffect(() => {
    if (!form.category && cats?.length) setForm(f => ({ ...f, category: cats[0].slug }));
  }, [cats, form.category]);

  const add = async (e) => {
    e.preventDefault(); setBusy(true);
    try {
      await api.post("/admin/feed-sources", form);
      toast.success("ఫీడ్ జోడించబడింది");
      setForm({ ...EMPTY, category: cats?.[0]?.slug || "" });
      load();
    } catch (err) { toast.error(err.response?.data?.detail || "Save failed"); }
    finally { setBusy(false); }
  };

  const sync = async (id) => {
    setBusy(true);
    try {
      const { data } = await api.post(`/admin/feed-sources/${id}/sync`);
      if (data.error) toast.error(`Sync failed: ${data.error}`);
      else toast.success(`ఇంపోర్ట్: ${data.imported}, స్కిప్: ${data.skipped}`);
      load();
    } catch (err) { toast.error(err.response?.data?.detail || "Sync failed"); }
    finally { setBusy(false); }
  };

  const syncAll = async () => {
    setBusy(true);
    try {
      const { data } = await api.post("/admin/feed-sources/sync-all");
      toast.success(`${data.total} ఫీడ్‌లు సింక్ అయ్యాయి`);
      load();
    } catch { toast.error("Sync all failed"); }
    finally { setBusy(false); }
  };

  const toggle = async (item) => {
    try {
      await api.put(`/admin/feed-sources/${item.id}`, { is_active: !item.is_active });
      load();
    } catch { toast.error("Update failed"); }
  };

  const del = async (id) => {
    if (!window.confirm("Delete this feed source?")) return;
    try {
      await api.delete(`/admin/feed-sources/${id}`);
      toast.success("తొలగించబడింది");
      load();
    } catch { toast.error("Delete failed"); }
  };

  const selectedHint = SOURCE_TYPES.find(s => s.value === form.source_type)?.hint;

  return (
    <div data-testid="feed-sources-tab" className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div className="bg-white border border-[#E2E8F0]">
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#E2E8F0]">
          <h3 className="font-serif-editorial font-bold">Feed Sources</h3>
          <button onClick={syncAll} disabled={busy} data-testid="feed-sync-all"
            className="cat-tag bg-brand-blue text-white px-3 py-1 flex items-center gap-1">
            <RefreshCw className={`w-3 h-3 ${busy ? "animate-spin" : ""}`}/> Sync All
          </button>
        </div>
        {loading ? <div className="p-4">{T.loading}</div> :
         items.length === 0 ? <div className="p-4 text-[#475569]" data-testid="feed-empty">ఇంకా ఫీడ్‌లు లేవు.</div> :
         items.map((f, i) => {
           const src = SOURCE_TYPES.find(s => s.value === f.source_type);
           const Icon = src?.Icon || Rss;
           return (
             <div key={f.id} className="px-4 py-3 border-b border-[#E2E8F0] flex items-center gap-3" data-testid={`feed-row-${i}`}>
               <Icon className="w-5 h-5 text-brand-red flex-shrink-0" />
               <div className="flex-1 min-w-0">
                 <div className="font-medium truncate">{f.name}</div>
                 <div className="text-xs text-[#475569] font-mono truncate">{f.feed_url}</div>
                 <div className="text-xs text-[#475569]">
                   → {f.category}
                   {f.last_sync_result && (
                     <span className="ml-2">
                       Last: {f.last_sync_result.imported} imported / {f.last_sync_result.skipped} skipped
                     </span>
                   )}
                 </div>
               </div>
               <label className="cursor-pointer">
                 <input type="checkbox" checked={f.is_active} onChange={() => toggle(f)} data-testid={`feed-active-${i}`}/>
               </label>
               <button onClick={() => sync(f.id)} disabled={busy} data-testid={`feed-sync-${i}`}
                 className="p-1 hover:text-brand-red"><RefreshCw className={`w-4 h-4 ${busy ? "animate-spin" : ""}`}/></button>
               <button onClick={() => del(f.id)} data-testid={`feed-delete-${i}`}
                 className="p-1 hover:text-brand-red"><Trash2 className="w-4 h-4"/></button>
             </div>
           );
         })}
      </div>

      <form onSubmit={add} className="bg-white border border-[#E2E8F0] p-4 space-y-3 h-fit" data-testid="feed-form">
        <h3 className="font-serif-editorial font-bold">Add Feed Source</h3>
        <div>
          <label className="cat-tag block mb-1">Source Type</label>
          <select value={form.source_type} onChange={e => setForm({...form, source_type: e.target.value})}
            data-testid="feed-form-type" className="w-full px-3 py-2 border border-[#E2E8F0] bg-white">
            {SOURCE_TYPES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
          {selectedHint && <p className="text-xs text-[#475569] mt-1 border-l-2 border-brand-red pl-2">{selectedHint}</p>}
        </div>
        <div>
          <label className="cat-tag block mb-1">Display Name</label>
          <input required value={form.name} onChange={e => setForm({...form, name: e.target.value})}
            placeholder="e.g. News 9 FB Page"
            data-testid="feed-form-name"
            className="w-full px-3 py-2 border border-[#E2E8F0]"/>
        </div>
        <div>
          <label className="cat-tag block mb-1">Feed URL</label>
          <input required value={form.feed_url} onChange={e => setForm({...form, feed_url: e.target.value})}
            placeholder="https://..."
            data-testid="feed-form-url"
            className="w-full px-3 py-2 border border-[#E2E8F0] font-mono text-sm"/>
        </div>
        <div>
          <label className="cat-tag block mb-1">Import into Category</label>
          <select value={form.category} onChange={e => setForm({...form, category: e.target.value})}
            data-testid="feed-form-category"
            className="w-full px-3 py-2 border border-[#E2E8F0] bg-white">
            {(cats || []).map(c => <option key={c.slug} value={c.slug}>{c.name_te} ({c.name_en})</option>)}
          </select>
        </div>
        <button type="submit" disabled={busy} data-testid="feed-form-submit"
          className="bg-brand-red text-white px-4 py-2 cat-tag flex items-center gap-2">
          <Plus className="w-4 h-4"/> Add Feed
        </button>
        <div className="text-xs text-[#475569] pt-2 border-t border-[#E2E8F0]">
          <strong>Note:</strong> Facebook, Twitter, and Instagram do not offer free official RSS. Use RSSHub proxy (https://rsshub.app) or Nitter for Twitter. YouTube RSS is free and reliable.
        </div>
      </form>
    </div>
  );
}
