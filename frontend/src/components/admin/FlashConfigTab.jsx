import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { Save, Zap } from "lucide-react";
import { T } from "@/lib/i18n";

export default function FlashConfigTab({ cats }) {
  const [form, setForm] = useState({ category_slugs: [], use_featured_only: false });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await api.get("/settings/flash-config");
      setForm(data); setLoading(false);
    })();
  }, []);

  const toggle = (slug) => {
    setForm(f => ({
      ...f,
      category_slugs: f.category_slugs.includes(slug)
        ? f.category_slugs.filter(s => s !== slug)
        : [...f.category_slugs, slug],
    }));
  };

  const submit = async (e) => {
    e.preventDefault(); setSaving(true);
    try {
      await api.put("/admin/settings/flash-config", form);
      toast.success("బ్రేకింగ్ న్యూస్ కాన్ఫిగ్ సేవ్ అయింది");
    } catch { toast.error("Save failed"); }
    finally { setSaving(false); }
  };

  if (loading) return <div>{T.loading}</div>;

  return (
    <form onSubmit={submit} className="bg-white border border-[#E2E8F0] p-6 max-w-3xl space-y-4" data-testid="flash-config-tab">
      <h3 className="font-serif-editorial font-bold text-lg flex items-center gap-2">
        <Zap className="w-5 h-5 text-brand-red"/> బ్రేకింగ్ న్యూస్ మార్కీ కాన్ఫిగ్
      </h3>
      <p className="text-sm text-[#475569] border-l-2 border-brand-red pl-3">
        టాప్ మార్కీలో ఏ విభాగాల నుంచి బ్రేకింగ్ న్యూస్ చూపించాలో ఎంచుకోండి.
        ఏదీ ఎంచుకోకపోతే అన్ని విభాగాల నుంచి తీసుకుంటుంది.
      </p>
      <div>
        <label className="cat-tag block mb-2">విభాగాలు ఎంచుకోండి</label>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
          {cats.map(c => (
            <label key={c.slug} className="flex items-center gap-2 cursor-pointer border border-[#E2E8F0] p-2 hover:bg-slate-50"
              data-testid={`flash-cat-${c.slug}`}>
              <input type="checkbox" checked={form.category_slugs.includes(c.slug)} onChange={() => toggle(c.slug)}/>
              <span className="font-serif-editorial">{c.name_te}</span>
              <span className="text-xs text-[#475569] ml-auto">({c.name_en})</span>
            </label>
          ))}
        </div>
      </div>
      <label className="flex items-center gap-2 cursor-pointer">
        <input type="checkbox" checked={form.use_featured_only} onChange={e => setForm({...form, use_featured_only: e.target.checked})}
          data-testid="flash-use-featured"/>
        <span className="cat-tag">ఫీచర్డ్ వార్తలు మాత్రమే (Flash flag కి బదులు)</span>
      </label>
      <button type="submit" disabled={saving} data-testid="flash-config-save"
        className="bg-brand-red hover:bg-brand-red text-white px-4 py-2 cat-tag flex items-center gap-2">
        <Save className="w-4 h-4"/> {saving ? T.uploading : T.save}
      </button>
    </form>
  );
}
