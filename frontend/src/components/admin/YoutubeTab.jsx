import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { RefreshCw, Youtube, Save } from "lucide-react";
import { T } from "@/lib/i18n";

export default function YoutubeTab({ cats }) {
  const [form, setForm] = useState({ channel_id: "", auto_import: true, default_category: "videos" });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [lastSync, setLastSync] = useState(null);

  useEffect(() => {
    (async () => {
      const { data } = await api.get("/settings/youtube");
      setForm(data); setLoading(false);
    })();
  }, []);

  const submit = async (e) => {
    e.preventDefault(); setSaving(true);
    try {
      await api.put("/admin/settings/youtube", form);
      toast.success("యూట్యూబ్ సెట్టింగ్‌లు సేవ్ అయ్యాయి");
    } catch (err) { toast.error(err.response?.data?.detail || "Save failed"); }
    finally { setSaving(false); }
  };

  const sync = async () => {
    if (!form.channel_id) { toast.error("channel_id ఇవ్వండి"); return; }
    setSyncing(true);
    try {
      const { data } = await api.post("/admin/youtube/sync");
      setLastSync(data);
      toast.success(`ఇంపోర్ట్: ${data.imported}, స్కిప్: ${data.skipped}`);
    } catch (err) {
      toast.error(err.response?.data?.detail || "Sync failed");
    } finally { setSyncing(false); }
  };

  if (loading) return <div>{T.loading}</div>;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6" data-testid="youtube-tab">
      <form onSubmit={submit} className="bg-white border border-[#E2E8F0] p-6 space-y-4">
        <h3 className="font-serif-editorial font-bold text-lg flex items-center gap-2">
          <Youtube className="w-5 h-5 text-brand-red" /> {T.youtubeSync}
        </h3>
        <div>
          <label className="cat-tag block mb-1">{T.channelId}</label>
          <input required value={form.channel_id} onChange={e => setForm({...form, channel_id: e.target.value})}
            placeholder="UCxxxxxxxxxxxxxxxxxxxx"
            data-testid="yt-channel-id"
            className="w-full px-3 py-2 border border-[#E2E8F0] focus:outline-none focus:border-brand-red font-mono text-sm"/>
          <p className="text-xs text-[#475569] mt-1">{T.channelIdHelp}</p>
        </div>
        <div>
          <label className="cat-tag block mb-1">{T.defaultCategory}</label>
          <select value={form.default_category} onChange={e => setForm({...form, default_category: e.target.value})}
            data-testid="yt-category"
            className="w-full px-3 py-2 border border-[#E2E8F0] bg-white">
            {cats.map(c => <option key={c.slug} value={c.slug}>{c.name_te} ({c.name_en})</option>)}
          </select>
        </div>
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={form.auto_import} onChange={e => setForm({...form, auto_import: e.target.checked})}
            data-testid="yt-auto"/>
          <span className="cat-tag">{T.autoImport}</span>
        </label>
        <div className="flex gap-2">
          <button type="submit" disabled={saving} data-testid="yt-save"
            className="bg-brand-red hover:bg-brand-red transition-colors text-white px-4 py-2 cat-tag flex items-center gap-2">
            <Save className="w-4 h-4" /> {saving ? T.uploading : T.save}
          </button>
          <button type="button" onClick={sync} disabled={syncing || !form.channel_id} data-testid="yt-sync"
            className="border border-brand-blue text-brand-blue hover:bg-brand-blue hover:text-white transition-colors px-4 py-2 cat-tag flex items-center gap-2 disabled:opacity-50">
            <RefreshCw className={`w-4 h-4 ${syncing ? "animate-spin" : ""}`} /> {syncing ? T.syncing : T.syncNow}
          </button>
        </div>
      </form>

      <div className="bg-white border border-[#E2E8F0] p-6">
        <h3 className="font-serif-editorial font-bold text-lg mb-3">సింక్ ఫలితం</h3>
        {lastSync ? (
          <div className="space-y-2 text-sm" data-testid="yt-result">
            <div><span className="cat-tag text-brand-red">Channel:</span> {lastSync.channel_id}</div>
            <div><span className="cat-tag text-brand-red">Imported:</span> {lastSync.imported}</div>
            <div><span className="cat-tag text-brand-red">Skipped (already exists):</span> {lastSync.skipped}</div>
          </div>
        ) : (
          <p className="text-sm text-[#475569]">సింక్ చేయలేదు. Save చేసి Sync Now క్లిక్ చేయండి.</p>
        )}
        <div className="mt-6 p-3 bg-slate-50 border-l-2 border-brand-blue text-xs text-[#475569]">
          <p><strong>ఎలా పని చేస్తుంది?</strong></p>
          <p className="mt-1">
            మీ యూట్యూబ్ చానెల్‌లో కొత్త వీడియో అప్‌లోడ్ చేసినప్పుడు, ఇక్కడ Sync Now క్లిక్ చేయండి —
            RSS ఫీడ్ ద్వారా అన్ని కొత్త వీడియోలు వెబ్‌సైట్‌లోని {form.default_category} విభాగంలో స్వయంచాలకంగా జోడించబడతాయి.
            API కీ అవసరం లేదు.
          </p>
        </div>
      </div>
    </div>
  );
}
