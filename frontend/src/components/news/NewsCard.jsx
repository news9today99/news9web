import { Link } from "react-router-dom";
import { PlayCircle, Camera } from "lucide-react";
import { resolveImageUrl, formatDate } from "@/lib/api";

export function NewsCard({ item, variant = "default", testId }) {
  const img = resolveImageUrl(item.image_url) ||
    "https://images.unsplash.com/photo-1495020689067-958852a7765e?w=800";
  const hasVideo = !!item.youtube_url;
  const isPhoto = item.category === "photos";

  if (variant === "hero") {
    return (
      <Link
        to={`/article/${item.id}`}
        data-testid={testId}
        className="news-card group block relative overflow-hidden bg-black h-[420px] md:h-[520px]"
      >
        <img src={img} alt={item.title} className="news-card-img absolute inset-0 w-full h-full object-cover opacity-90" />
        <div className="hero-overlay absolute inset-0" />
        <div className="absolute bottom-0 left-0 right-0 p-6 md:p-8 text-white">
          <div className="flex items-center gap-2 mb-3">
            <span className="cat-tag bg-[#DC2626] px-2 py-1">{item.category}</span>
            {hasVideo && <PlayCircle className="w-5 h-5" />}
          </div>
          <h2 className="font-serif-editorial font-black text-3xl md:text-4xl leading-tight mb-2 group-hover:text-[#FCA5A5] transition-colors">
            {item.title}
          </h2>
          <p className="text-sm text-slate-200 line-clamp-2 max-w-3xl">{item.summary}</p>
          <div className="cat-tag text-slate-300 mt-3">{formatDate(item.created_at)} · {item.author}</div>
        </div>
      </Link>
    );
  }

  if (variant === "compact") {
    return (
      <Link
        to={`/article/${item.id}`}
        data-testid={testId}
        className="news-card group flex gap-3 border-b border-[#E2E8F0] pb-3 hover:bg-white transition-colors"
      >
        <div className="relative w-24 h-20 flex-shrink-0 overflow-hidden bg-slate-100">
          <img src={img} alt={item.title} className="news-card-img w-full h-full object-cover" />
          {hasVideo && (
            <PlayCircle className="absolute inset-0 m-auto w-6 h-6 text-white drop-shadow-lg" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="cat-tag text-[#DC2626] mb-1">{item.category}</div>
          <h3 className="font-serif-editorial font-bold text-base leading-snug line-clamp-2 group-hover:text-[#DC2626] transition-colors">
            {item.title}
          </h3>
        </div>
      </Link>
    );
  }

  return (
    <Link
      to={`/article/${item.id}`}
      data-testid={testId}
      className="news-card group block bg-white border border-[#E2E8F0] overflow-hidden hover:border-[#DC2626] transition-colors"
    >
      <div className="relative aspect-[16/10] overflow-hidden bg-slate-100">
        <img src={img} alt={item.title} className="news-card-img w-full h-full object-cover" />
        <div className="absolute top-2 left-2 flex gap-2">
          <span className="cat-tag bg-[#DC2626] text-white px-2 py-1">{item.category}</span>
        </div>
        {hasVideo && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity">
            <PlayCircle className="w-14 h-14 text-white" />
          </div>
        )}
        {isPhoto && !hasVideo && (
          <div className="absolute bottom-2 right-2 bg-black/70 text-white px-2 py-1 flex items-center gap-1">
            <Camera className="w-3 h-3" />
            <span className="cat-tag text-[0.6rem]">Gallery</span>
          </div>
        )}
      </div>
      <div className="p-4">
        <h3 className="font-serif-editorial font-bold text-lg leading-snug mb-2 line-clamp-2 group-hover:text-[#DC2626] transition-colors">
          {item.title}
        </h3>
        <p className="text-sm text-[#475569] line-clamp-2 mb-2">{item.summary}</p>
        <div className="cat-tag text-[#475569]">{formatDate(item.created_at)} · {item.author}</div>
      </div>
    </Link>
  );
}
