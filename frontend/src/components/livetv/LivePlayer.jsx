import { useEffect, useRef } from "react";
import Hls from "hls.js";
import { Radio } from "lucide-react";

// Supports: youtube (iframe embed URL), hls (.m3u8), mp4 (direct video URL)
export default function LivePlayer({ url, streamType, titleTe, titleEn }) {
  const videoRef = useRef(null);
  const hlsRef = useRef(null);

  useEffect(() => {
    if (!videoRef.current || !url) return;
    if (streamType !== "hls" && streamType !== "mp4") return;

    const video = videoRef.current;

    if (streamType === "hls") {
      if (Hls.isSupported()) {
        hlsRef.current?.destroy();
        const hls = new Hls();
        hlsRef.current = hls;
        hls.loadSource(url);
        hls.attachMedia(video);
      } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
        video.src = url;
      }
    } else if (streamType === "mp4") {
      video.src = url;
    }

    return () => { hlsRef.current?.destroy(); };
  }, [url, streamType]);

  if (!url) {
    return <div className="aspect-video bg-black flex items-center justify-center text-white text-sm">No live stream configured</div>;
  }

  if (streamType === "youtube") {
    return (
      <iframe
        className="w-full aspect-video"
        src={url}
        title={titleEn || "Live TV"}
        frameBorder="0"
        allow="accelerometer; autoplay; encrypted-media; picture-in-picture"
        allowFullScreen
        data-testid="live-tv-iframe"
      />
    );
  }

  return (
    <video
      ref={videoRef}
      controls
      autoPlay
      muted
      playsInline
      className="w-full aspect-video bg-black"
      data-testid="live-tv-video"
    />
  );
}
