import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { Save, FileText } from "lucide-react";
import RichTextEditor from "@/components/editor/RichTextEditor";
import { T } from "@/lib/i18n";

const PAGES = [
  { slug: "privacy", label: T.privacyPolicy },
  { slug: "terms", label: T.termsConditions },
];

export default function PagesTab() {
  const [active, setActive] = useState("privacy");
  const [page, setPage] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setLoading(true);
    (async () => {
      const { data } = await api.get(`/pages/${active}`);
      setPage(data); setLoading(false);
    })();
  }, [active]);

  const submit = async (e) => {
    e.preventDefault(); setSaving(true);
    try {
      await api.put(`/admin/pages/${active}`, {
        title_en: page.title_en, title_te: page.title_te, body: page.body,
      });
      toast.success("పేజీ సేవ్ అయింది");
    } catch (err) { toast.error("Save failed"); }
    finally { setSaving(false); }
  };

  return (
    <div data-testid="pages-tab">
      <div className="flex gap-2 mb-4">
        {PAGES.map(p => (
          <button key={p.slug} onClick={() => setActive(p.slug)} data-testid={`page-select-${p.slug}`}
            className={`px-4 py-2 cat-tag border-b-2 ${active === p.slug ? "border-brand-red text-brand-red" : "border-transparent hover:text-brand-red"}`}>
            <FileText className="w-4 h-4 inline mr-1"/> {p.label}
          </button>
        ))}
      </div>
      {loading || !page ? <div>{T.loading}</div> : (
        <form onSubmit={submit} className="bg-white border border-[#E2E8F0] p-6 space-y-4" data-testid={`pages-form-${active}`}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="cat-tag block mb-1">{T.nameEnglish}</label>
              <input value={page.title_en} onChange={e => setPage({...page, title_en: e.target.value})}
                data-testid={`page-${active}-title-en`}
                className="w-full px-3 py-2 border border-[#E2E8F0] focus:outline-none focus:border-brand-red"/>
            </div>
            <div>
              <label className="cat-tag block mb-1">{T.nameTelugu}</label>
              <input value={page.title_te} onChange={e => setPage({...page, title_te: e.target.value})}
                data-testid={`page-${active}-title-te`}
                className="w-full px-3 py-2 border border-[#E2E8F0] focus:outline-none focus:border-brand-red font-serif-editorial"/>
            </div>
          </div>
          <div>
            <label className="cat-tag block mb-1">{T.body}</label>
            <RichTextEditor value={page.body} onChange={(v) => setPage({...page, body: v})} testId={`page-${active}-body`}/>
          </div>
          <button type="submit" disabled={saving} data-testid={`page-${active}-save`}
            className="bg-brand-red hover:bg-brand-red text-white px-4 py-2 cat-tag flex items-center gap-2">
            <Save className="w-4 h-4"/> {saving ? T.uploading : T.save}
          </button>
        </form>
      )}
    </div>
  );
}
