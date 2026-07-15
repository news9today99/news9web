import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { Save, Palette } from "lucide-react";
import { useTheme } from "@/contexts/ThemeContext";
import { T } from "@/lib/i18n";

export default function ThemeTab() {
  const { reload } = useTheme();
  const [form, setForm] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await api.get("/settings/theme");
      setForm(data); setLoading(false);
    })();
  }, []);

  const submit = async (e) => {
    e.preventDefault(); setSaving(true);
    try {
      await api.put("/admin/settings/theme", form);
      await reload();
      toast.success("థీమ్ సేవ్ అయింది");
    } catch { toast.error("Save failed"); }
    finally { setSaving(false); }
  };

  if (loading) return <div>{T.loading}</div>;

  const field = (key, label, type = "text") => (
    <div>
      <label className="cat-tag block mb-1">{label}</label>
      <input type={type} value={form[key] || ""} onChange={e => setForm({...form, [key]: e.target.value})}
        data-testid={`theme-${key}`}
        className="w-full px-3 py-2 border border-[#E2E8F0] focus:outline-none focus:border-brand-red"/>
    </div>
  );

  return (
    <form onSubmit={submit} className="grid grid-cols-1 lg:grid-cols-2 gap-6 max-w-4xl" data-testid="theme-tab">
      <div className="bg-white border border-[#E2E8F0] p-6 space-y-4">
        <h3 className="font-serif-editorial font-bold text-lg flex items-center gap-2">
          <Palette className="w-5 h-5 text-brand-red"/> థీమ్ కలర్‌లు
        </h3>
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="cat-tag block mb-1">Primary</label>
            <div className="flex gap-2">
              <input type="color" value={form.primary_color || "#E11D2E"} onChange={e => setForm({...form, primary_color: e.target.value})}
                data-testid="theme-primary_color-picker"
                className="h-10 w-14 border border-[#E2E8F0] p-0"/>
              <input value={form.primary_color || ""} onChange={e => setForm({...form, primary_color: e.target.value})}
                data-testid="theme-primary_color"
                className="flex-1 px-2 py-2 border border-[#E2E8F0] font-mono text-xs"/>
            </div>
          </div>
          <div>
            <label className="cat-tag block mb-1">Secondary</label>
            <div className="flex gap-2">
              <input type="color" value={form.secondary_color || "#1E4B9C"} onChange={e => setForm({...form, secondary_color: e.target.value})}
                data-testid="theme-secondary_color-picker" className="h-10 w-14 border border-[#E2E8F0] p-0"/>
              <input value={form.secondary_color || ""} onChange={e => setForm({...form, secondary_color: e.target.value})}
                data-testid="theme-secondary_color"
                className="flex-1 px-2 py-2 border border-[#E2E8F0] font-mono text-xs"/>
            </div>
          </div>
          <div>
            <label className="cat-tag block mb-1">Accent</label>
            <div className="flex gap-2">
              <input type="color" value={form.accent_color || "#0F2A5C"} onChange={e => setForm({...form, accent_color: e.target.value})}
                data-testid="theme-accent_color-picker" className="h-10 w-14 border border-[#E2E8F0] p-0"/>
              <input value={form.accent_color || ""} onChange={e => setForm({...form, accent_color: e.target.value})}
                data-testid="theme-accent_color"
                className="flex-1 px-2 py-2 border border-[#E2E8F0] font-mono text-xs"/>
            </div>
          </div>
        </div>
        {field("logo_url", "లోగో URL")}
        {field("site_name_en", "సైట్ పేరు (ఇంగ్లీష్)")}
        {field("site_name_te", "సైట్ పేరు (తెలుగు)")}
        {field("tagline_en", "ట్యాగ్‌లైన్ (ఇంగ్లీష్)")}
        {field("tagline_te", "ట్యాగ్‌లైన్ (తెలుగు)")}
        <button type="submit" disabled={saving} data-testid="theme-save"
          className="bg-brand-red hover:bg-brand-red text-white px-4 py-2 cat-tag flex items-center gap-2">
          <Save className="w-4 h-4"/> {saving ? T.uploading : T.save}
        </button>
      </div>

      <div className="bg-white border border-[#E2E8F0] p-6" data-testid="theme-preview">
        <h3 className="font-serif-editorial font-bold text-lg mb-3">Preview</h3>
        <div className="flex items-center gap-3 mb-4">
          <img src={form.logo_url} alt="" className="h-12" onError={e => { e.target.style.display = "none"; }} />
          <div>
            <div className="font-serif-editorial font-black text-lg">{form.site_name_te}</div>
            <div className="text-xs text-[#475569]">{form.tagline_te}</div>
          </div>
        </div>
        <div className="space-y-2">
          <div className="p-3" style={{ backgroundColor: form.primary_color, color: "white" }}>Primary color</div>
          <div className="p-3" style={{ backgroundColor: form.secondary_color, color: "white" }}>Secondary color</div>
          <div className="p-3" style={{ backgroundColor: form.accent_color, color: "white" }}>Accent color</div>
        </div>
      </div>
    </form>
  );
}
