import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { Save, Radio } from "lucide-react";
import LivePlayer from "@/components/livetv/LivePlayer";
import { T } from "@/lib/i18n";

export default function LiveTVTab() {
  const [form, setForm] = useState({ url: "", stream_type: "youtube", title_en: "", title_te: "" });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await api.get("/settings/livetv");
      setForm(data); setLoading(false);
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

  if (loading) return <div>{T.loading}</div>;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6" data-testid="livetv-tab">
      <form onSubmit={submit} className="bg-white border border-[#E2E8F0] p-6 space-y-4">
        <h3 className="font-serif-editorial font-bold text-lg flex items-center gap-2">
          <Radio className="w-5 h-5 text-brand-red" /> {T.liveTvSettings}
        </h3>
        <p className="text-xs text-[#475569] leading-relaxed border-l-2 border-brand-red pl-3">{T.liveTvHelp}</p>
        <div>
          <label className="cat-tag block mb-1">{T.streamType}</label>
          <select value={form.stream_type} onChange={e => setForm({...form, stream_type: e.target.value})}
            data-testid="livetv-type" className="w-full px-3 py-2 border border-[#E2E8F0] bg-white">
            <option value="youtube">{T.streamTypeYoutube}</option>
            <option value="hls">{T.streamTypeHls}</option>
            <option value="mp4">{T.streamTypeMp4}</option>
          </select>
        </div>
        <div>
          <label className="cat-tag block mb-1">{T.streamUrl}</label>
          <input required value={form.url} onChange={e => setForm({...form, url: e.target.value})}
            placeholder={form.stream_type === "youtube" ? "https://www.youtube.com/embed/VIDEO_ID" :
              form.stream_type === "hls" ? "https://example.com/stream.m3u8" : "https://example.com/stream.mp4"}
            data-testid="livetv-url"
            className="w-full px-3 py-2 border border-[#E2E8F0] focus:outline-none focus:border-brand-red font-mono text-sm"/>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="cat-tag block mb-1">{T.channelTitleEn}</label>
            <input value={form.title_en || ""} onChange={e => setForm({...form, title_en: e.target.value})}
              data-testid="livetv-title-en" className="w-full px-3 py-2 border border-[#E2E8F0] focus:outline-none focus:border-brand-red"/>
          </div>
          <div>
            <label className="cat-tag block mb-1">{T.channelTitleTe}</label>
            <input value={form.title_te || ""} onChange={e => setForm({...form, title_te: e.target.value})}
              data-testid="livetv-title-te" className="w-full px-3 py-2 border border-[#E2E8F0] focus:outline-none focus:border-brand-red font-serif-editorial"/>
          </div>
        </div>
        <button type="submit" disabled={saving} data-testid="livetv-save"
          className="bg-brand-red hover:bg-brand-red transition-colors text-white px-4 py-2 cat-tag flex items-center gap-2">
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
