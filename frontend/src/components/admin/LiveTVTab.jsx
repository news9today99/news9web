import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { Save, Radio, Plus, Trash2, X } from "lucide-react";
import LivePlayer from "@/components/livetv/LivePlayer";
import { T } from "@/lib/i18n";

const EMPTY_CHANNEL = { name_te: "", name_en: "", url: "", stream_type: "youtube", order: 100, is_active: true };

export default function LiveTVTab() {
  const [form, setForm] = useState({ url: "", stream_type: "youtube", title_en: "", title_te: "", channels: [] });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [newCh, setNewCh] = useState(EMPTY_CHANNEL);

  useEffect(() => {
    (async () => {
      const { data } = await api.get("/settings/livetv");
      setForm({ ...data, channels: data.channels || [] });
      setLoading(false);
    })();
  }, []);

  const submit = async (e) => {
    e.preventDefault(); setSaving(true);
    try {
      await api.put("/admin/settings/livetv", form);
      toast.success("లైవ్ టీవీ సెట్టింగ్‌లు సేవ్ అయ్యాయి");
    } catch { toast.error("Save failed"); }
    finally { setSaving(false); }
  };

  const addChannel = () => {
    if (!newCh.url || !(newCh.name_te || newCh.name_en)) {
      toast.error("URL మరియు పేరు అవసరం"); return;
    }
    setForm(f => ({ ...f, channels: [...(f.channels || []), { ...newCh }] }));
    setNewCh(EMPTY_CHANNEL);
  };

  const removeChannel = (idx) => {
    setForm(f => ({ ...f, channels: f.channels.filter((_, i) => i !== idx) }));
  };

  if (loading) return <div>{T.loading}</div>;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6" data-testid="livetv-tab">
      <form onSubmit={submit} className="bg-white border border-[#E2E8F0] p-6 space-y-4">
        <h3 className="font-serif-editorial font-bold text-lg flex items-center gap-2">
          <Radio className="w-5 h-5 text-brand-red" /> {T.liveTvSettings}
        </h3>
        <p className="text-xs text-[#475569] leading-relaxed border-l-2 border-brand-red pl-3">{T.liveTvHelp}</p>
        <div>
          <label className="cat-tag block mb-1">{T.streamType} (default channel)</label>
          <select value={form.stream_type} onChange={e => setForm({...form, stream_type: e.target.value})}
            data-testid="livetv-type" className="w-full px-3 py-2 border border-[#E2E8F0] bg-white">
            <option value="youtube">{T.streamTypeYoutube}</option>
            <option value="hls">{T.streamTypeHls}</option>
            <option value="mp4">{T.streamTypeMp4}</option>
          </select>
        </div>
        <div>
          <label className="cat-tag block mb-1">{T.streamUrl} (default)</label>
          <input required value={form.url} onChange={e => setForm({...form, url: e.target.value})}
            data-testid="livetv-url"
            className="w-full px-3 py-2 border border-[#E2E8F0] focus:outline-none focus:border-brand-red font-mono text-sm"/>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="cat-tag block mb-1">{T.channelTitleEn}</label>
            <input value={form.title_en || ""} onChange={e => setForm({...form, title_en: e.target.value})}
              data-testid="livetv-title-en" className="w-full px-3 py-2 border border-[#E2E8F0]"/>
          </div>
          <div>
            <label className="cat-tag block mb-1">{T.channelTitleTe}</label>
            <input value={form.title_te || ""} onChange={e => setForm({...form, title_te: e.target.value})}
              data-testid="livetv-title-te" className="w-full px-3 py-2 border border-[#E2E8F0] font-serif-editorial"/>
          </div>
        </div>

        {/* Channels list */}
        <div className="pt-4 border-t border-[#E2E8F0]">
          <h4 className="cat-tag text-brand-red mb-3 flex items-center gap-1">{T.channels} ({(form.channels || []).length})</h4>
          <div className="space-y-2 mb-3" data-testid="channel-list">
            {(form.channels || []).map((ch, i) => (
              <div key={i} className="flex items-center gap-2 border border-[#E2E8F0] p-2" data-testid={`channel-row-${i}`}>
                <div className="flex-1 min-w-0">
                  <div className="font-serif-editorial text-sm">{ch.name_te} <span className="text-xs text-[#475569]">({ch.name_en})</span></div>
                  <div className="text-xs text-[#475569] font-mono truncate">{ch.url}</div>
                </div>
                <span className="cat-tag text-[0.6rem] px-1 bg-slate-100">{ch.stream_type}</span>
                <button type="button" onClick={() => removeChannel(i)} data-testid={`channel-remove-${i}`}
                  className="p-1 hover:text-brand-red"><Trash2 className="w-4 h-4"/></button>
              </div>
            ))}
            {(form.channels || []).length === 0 && (
              <p className="text-xs text-[#475569]">ఇంకా చానెల్‌లు లేవు. కింద జోడించండి.</p>
            )}
          </div>
          <div className="bg-slate-50 border border-[#E2E8F0] p-3 space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <input placeholder="Name (Telugu)" value={newCh.name_te}
                onChange={e => setNewCh({...newCh, name_te: e.target.value})}
                data-testid="channel-new-name-te"
                className="px-2 py-1 border border-[#E2E8F0] text-sm font-serif-editorial"/>
              <input placeholder="Name (English)" value={newCh.name_en}
                onChange={e => setNewCh({...newCh, name_en: e.target.value})}
                data-testid="channel-new-name-en"
                className="px-2 py-1 border border-[#E2E8F0] text-sm"/>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <select value={newCh.stream_type} onChange={e => setNewCh({...newCh, stream_type: e.target.value})}
                data-testid="channel-new-type"
                className="px-2 py-1 border border-[#E2E8F0] text-sm bg-white">
                <option value="youtube">YouTube</option>
                <option value="hls">HLS</option>
                <option value="mp4">MP4</option>
              </select>
              <input placeholder="URL" value={newCh.url}
                onChange={e => setNewCh({...newCh, url: e.target.value})}
                data-testid="channel-new-url"
                className="col-span-2 px-2 py-1 border border-[#E2E8F0] text-sm font-mono"/>
            </div>
            <button type="button" onClick={addChannel} data-testid="channel-add-btn"
              className="bg-brand-blue text-white px-3 py-1 cat-tag flex items-center gap-1 text-xs">
              <Plus className="w-3 h-3"/> Add Channel
            </button>
          </div>
        </div>

        <button type="submit" disabled={saving} data-testid="livetv-save"
          className="bg-brand-red text-white px-4 py-2 cat-tag flex items-center gap-2">
          <Save className="w-4 h-4" /> {saving ? T.uploading : T.saveSettings}
        </button>
      </form>

      <div className="bg-white border border-[#E2E8F0] p-6">
        <h3 className="font-serif-editorial font-bold text-lg mb-3">Preview</h3>
        {form.url && (
          <div>
            <LivePlayer url={form.url} streamType={form.stream_type} titleEn={form.title_en} titleTe={form.title_te} />
            <div className="mt-3">
              <div className="cat-tag text-brand-red">{T.onAir}</div>
              <div className="font-serif-editorial font-bold">{form.title_te}</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
