import { useEffect, useState } from "react";
import { api, resolveImageUrl } from "@/lib/api";

// Renders an ad slot. Placements: strip, image, video, sidebar
export default function AdSlot({ placement, className = "", testId }) {
  const [ads, setAds] = useState([]);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get(`/ads?placement=${placement}`);
        setAds(data);
      } catch (e) { /* ignore */ }
    })();
  }, [placement]);

  if (!ads.length) return null;
  const ad = ads[0]; // Show top-priority ad

  const inner = (
    <>
      {ad.video_url ? (
        <video src={resolveImageUrl(ad.video_url)} autoPlay muted loop playsInline
          className={placement === "strip" ? "w-full h-16 md:h-20 object-cover" : "w-full object-cover"} />
      ) : ad.image_url ? (
        <img src={resolveImageUrl(ad.image_url)} alt={ad.name}
          className={placement === "strip" ? "w-full h-16 md:h-20 object-cover" : "w-full object-cover"} />
      ) : (
        <div className="w-full h-16 flex items-center justify-center bg-slate-200 text-xs text-slate-600">{ad.name}</div>
      )}
    </>
  );

  const wrapperClass = `block relative ${className}`;
  const content = (
    <div className="relative">
      {inner}
      <span className="absolute top-1 right-1 bg-black/60 text-white text-[0.6rem] px-1 uppercase tracking-wider">Ad</span>
    </div>
  );

  if (ad.link_url) {
    return (
      <a href={ad.link_url} target="_blank" rel="noopener noreferrer sponsored"
         className={wrapperClass} data-testid={testId || `ad-${placement}`}>
        {content}
      </a>
    );
  }
  return <div className={wrapperClass} data-testid={testId || `ad-${placement}`}>{content}</div>;
}
