import { useState } from "react";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { Plus, Trash2, Edit3 } from "lucide-react";
import { T } from "@/lib/i18n";

export default function CategoriesTab({ cats, onChanged }) {
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ slug: "", name_en: "", name_te: "", name_hi: "", order: 100 });
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
      reset(); onChanged();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Save failed");
    } finally { setSaving(false); }
  };

  const del = async (slug) => {
    if (!window.confirm(`Delete ${slug}?`)) return;
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
              <button onClick={() => startEdit(c)} data-testid={`cat-edit-${i}`} className="p-1 hover:text-brand-red"><Edit3 className="w-4 h-4"/></button>
              <button onClick={() => del(c.slug)} data-testid={`cat-delete-${i}`} className="p-1 hover:text-brand-red"><Trash2 className="w-4 h-4"/></button>
            </div>
          </div>
        ))}
      </div>

      <form onSubmit={submit} className="bg-white border border-[#E2E8F0] p-4 space-y-3" data-testid="category-form">
        <h3 className="font-serif-editorial font-bold text-lg">{editing ? T.edit : T.addCategory}</h3>
        <div>
          <label className="cat-tag block mb-1">{T.slug}</label>
          <input required disabled={!!editing} value={form.slug} onChange={e => setForm({...form, slug: e.target.value})}
            placeholder="e.g. weather" data-testid="cat-form-slug"
            className="w-full px-3 py-2 border border-[#E2E8F0] disabled:bg-slate-100 focus:outline-none focus:border-brand-red"/>
        </div>
        <div>
          <label className="cat-tag block mb-1">{T.nameEnglish}</label>
          <input required value={form.name_en} onChange={e => setForm({...form, name_en: e.target.value})}
            data-testid="cat-form-name-en"
            className="w-full px-3 py-2 border border-[#E2E8F0] focus:outline-none focus:border-brand-red"/>
        </div>
        <div>
          <label className="cat-tag block mb-1">{T.nameTelugu}</label>
          <input required value={form.name_te} onChange={e => setForm({...form, name_te: e.target.value})}
            data-testid="cat-form-name-te"
            className="w-full px-3 py-2 border border-[#E2E8F0] focus:outline-none focus:border-brand-red font-serif-editorial"/>
        </div>
        <div>
          <label className="cat-tag block mb-1">पेरु (हिंदी)</label>
          <input value={form.name_hi || ""} onChange={e => setForm({...form, name_hi: e.target.value})}
            data-testid="cat-form-name-hi"
            className="w-full px-3 py-2 border border-[#E2E8F0] focus:outline-none focus:border-brand-red"/>
        </div>
        <div>
          <label className="cat-tag block mb-1">{T.order}</label>
          <input type="number" value={form.order} onChange={e => setForm({...form, order: e.target.value})}
            data-testid="cat-form-order"
            className="w-full px-3 py-2 border border-[#E2E8F0] focus:outline-none focus:border-brand-red"/>
        </div>
        <div className="flex gap-2 pt-2">
          <button type="submit" disabled={saving} data-testid="cat-form-submit"
            className="bg-brand-red hover:bg-brand-red transition-colors text-white px-4 py-2 cat-tag disabled:opacity-60">
            {saving ? "..." : T.save}
          </button>
          {editing && (
            <button type="button" onClick={reset} data-testid="cat-form-cancel"
              className="border border-[#E2E8F0] px-4 py-2 cat-tag hover:bg-slate-50">{T.cancel}</button>
          )}
        </div>
      </form>
    </div>
  );
}
