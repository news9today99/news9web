import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Twitter, Instagram, Facebook, Youtube, MessageCircle } from "lucide-react";

export default function SocialLinks({ variant = "footer" }) {
  const [contact, setContact] = useState(null);
  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get("/settings/contact");
        setContact(data);
      } catch (e) { /* ignore */ }
    })();
  }, []);
  if (!contact) return null;

  const links = [
    { key: "twitter", Icon: Twitter, label: "Twitter" },
    { key: "instagram", Icon: Instagram, label: "Instagram" },
    { key: "facebook", Icon: Facebook, label: "Facebook" },
    { key: "youtube", Icon: Youtube, label: "YouTube" },
    { key: "whatsapp", Icon: MessageCircle, label: "WhatsApp" },
  ].filter(l => contact[l.key]);

  if (!links.length) return null;

  if (variant === "header") {
    return (
      <div className="flex items-center gap-2" data-testid="social-header">
        {links.map(({ key, Icon, label }) => (
          <a key={key} href={contact[key]} target="_blank" rel="noopener noreferrer"
             data-testid={`social-${key}`}
             className="p-1 hover:text-brand-red transition-colors" title={label}>
            <Icon className="w-4 h-4" />
          </a>
        ))}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3 flex-wrap" data-testid="social-footer">
      {links.map(({ key, Icon, label }) => (
        <a key={key} href={contact[key]} target="_blank" rel="noopener noreferrer"
           data-testid={`social-${key}`}
           className="w-9 h-9 flex items-center justify-center border border-slate-700 hover:bg-brand-red hover:border-brand-red transition-colors"
           title={label}>
          <Icon className="w-4 h-4" />
        </a>
      ))}
    </div>
  );
}
