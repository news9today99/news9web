import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { Save, Phone } from "lucide-react";
import { T } from "@/lib/i18n";

export default function ContactTab() {
  const [form, setForm] = useState({ phone: "", email: "", address: "" });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await api.get("/settings/contact");
      setForm(data); setLoading(false);
    })();
  }, []);

  const submit = async (e) => {
    e.preventDefault(); setSaving(true);
    try {
      await api.put("/admin/settings/contact", form);
      toast.success("కాంటాక్ట్ సేవ్ అయింది");
    } catch { toast.error("Save failed"); }
    finally { setSaving(false); }
  };

  if (loading) return <div>{T.loading}</div>;

  return (
    <form onSubmit={submit} className="bg-white border border-[#E2E8F0] p-6 max-w-2xl space-y-4" data-testid="contact-tab">
      <h3 className="font-serif-editorial font-bold text-lg flex items-center gap-2">
        <Phone className="w-5 h-5 text-brand-red"/> {T.contactSettings}
      </h3>
      <div>
        <label className="cat-tag block mb-1">{T.phone}</label>
        <input required value={form.phone} onChange={e => setForm({...form, phone: e.target.value})}
          data-testid="contact-phone"
          className="w-full px-3 py-2 border border-[#E2E8F0] focus:outline-none focus:border-brand-red"/>
      </div>
      <div>
        <label className="cat-tag block mb-1">{T.email}</label>
        <input required type="email" value={form.email} onChange={e => setForm({...form, email: e.target.value})}
          data-testid="contact-email"
          className="w-full px-3 py-2 border border-[#E2E8F0] focus:outline-none focus:border-brand-red"/>
      </div>
      <div>
        <label className="cat-tag block mb-1">{T.address}</label>
        <input value={form.address || ""} onChange={e => setForm({...form, address: e.target.value})}
          data-testid="contact-address"
          className="w-full px-3 py-2 border border-[#E2E8F0] focus:outline-none focus:border-brand-red"/>
      </div>
      <button type="submit" disabled={saving} data-testid="contact-save"
        className="bg-brand-red hover:bg-brand-red text-white px-4 py-2 cat-tag flex items-center gap-2">
        <Save className="w-4 h-4"/> {saving ? T.uploading : T.save}
      </button>
    </form>
  );
}
