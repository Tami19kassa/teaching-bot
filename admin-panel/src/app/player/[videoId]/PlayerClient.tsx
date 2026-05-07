"use client";

import { useEffect, useRef, useState } from "react";

interface StreamData {
  signedUrl: string;
  title: string;
  levelName: string;
  watermark: string;
  thumbnailUrl: string;
}

type State = "loading" | "ready" | "error" | "denied";

export default function PlayerClient({ videoId }: { videoId: string }) {
  const [state, setState] = useState<State>("loading");
  const [streamData, setStreamData] = useState<StreamData | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<unknown>(null);

  useEffect(() => {
    // Telegram Mini App SDK is injected by Telegram automatically
    // window.Telegram.WebApp is available when opened inside Telegram
    const tg = (window as unknown as { Telegram?: { WebApp?: { initData: string; expand: () => void; ready: () => void } } }).Telegram?.WebApp;

    if (!tg) {
      setState("error");
      setErrorMsg("This page must be opened inside Telegram.");
      return;
    }

    tg.expand();
    tg.ready();

    const initData = tg.initData;
    if (!initData) {
      setState("error");
      setErrorMsg("Could not verify your Telegram identity.");
      return;
    }

    // Fetch signed stream URL from our backend
    fetch(`/api/stream/${videoId}`, {
      headers: { Authorization: `tma ${initData}` },
    })
      .then(async (res) => {
        if (res.status === 403) {
          setState("denied");
          return;
        }
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error ?? "Failed to load video");
        }
        return res.json() as Promise<StreamData>;
      })
      .then((data) => {
        if (!data) return;
        setStreamData(data);
        setState("ready");
      })
      .catch((err) => {
        setState("error");
        setErrorMsg(err.message);
      });
  }, [videoId]);

  // Initialize HLS.js once we have the signed URL
  useEffect(() => {
    if (state !== "ready" || !streamData || !videoRef.current) return;

    let destroyed = false;

    async function initPlayer() {
      const Hls = (await import("hls.js")).default;

      if (destroyed || !videoRef.current || !streamData) return;

      if (Hls.isSupported()) {
        const hls = new Hls({
          // Fetch each segment with a fresh signed URL approach
          // The playlist URL is already signed; segments inherit the token
          enableWorker: true,
          lowLatencyMode: false,
        });

        hls.loadSource(streamData.signedUrl);
        hls.attachMedia(videoRef.current);
        hlsRef.current = hls;

        hls.on(Hls.Events.ERROR, (_event: unknown, data: { fatal: boolean; type: string }) => {
          if (data.fatal) {
            setState("error");
            setErrorMsg("Stream error. The link may have expired — please go back and try again.");
          }
        });
      } else if (videoRef.current.canPlayType("application/vnd.apple.mpegurl")) {
        // Safari native HLS
        videoRef.current.src = streamData.signedUrl;
      } else {
        setState("error");
        setErrorMsg("Your browser does not support HLS video playback.");
      }
    }

    initPlayer();

    return () => {
      destroyed = true;
      if (hlsRef.current) {
        (hlsRef.current as { destroy: () => void }).destroy();
      }
    };
  }, [state, streamData]);

  // ── Render ────────────────────────────────────────────────────────────────

  if (state === "loading") {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center text-white">
          <div className="text-4xl mb-3 animate-pulse">⏳</div>
          <p className="text-sm text-gray-400">Verifying access...</p>
        </div>
      </div>
    );
  }

  if (state === "denied") {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center px-6">
        <div className="text-center text-white">
          <div className="text-5xl mb-4">🚫</div>
          <h2 className="text-xl font-bold text-red-400 mb-2">Access Denied</h2>
          <p className="text-gray-400 text-sm">
            You are not enrolled in this level. Purchase access through the bot.
          </p>
        </div>
      </div>
    );
  }

  if (state === "error") {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center px-6">
        <div className="text-center text-white">
          <div className="text-5xl mb-4">⚠️</div>
          <h2 className="text-xl font-bold text-yellow-400 mb-2">Error</h2>
          <p className="text-gray-400 text-sm">{errorMsg}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black flex flex-col">
      {/* Video container */}
      <div className="relative w-full bg-black" style={{ aspectRatio: "16/9" }}>
        <video
          ref={videoRef}
          className="w-full h-full"
          controls
          playsInline
          controlsList="nodownload"        // hides download button in browser
          disablePictureInPicture          // disables PiP (harder to screen record)
          onContextMenu={(e) => e.preventDefault()} // blocks right-click
        />

        {/* Dynamic watermark overlay — always visible, moves around */}
        {streamData && (
          <WatermarkOverlay text={streamData.watermark} />
        )}
      </div>

      {/* Video info */}
      {streamData && (
        <div className="px-4 py-3 bg-gray-950 flex-1">
          <p className="text-white font-semibold text-base">{streamData.title}</p>
          <p className="text-gray-400 text-sm mt-0.5">📘 {streamData.levelName}</p>
          <p className="text-gray-600 text-xs mt-3">
            🔒 Licensed to {streamData.watermark} · Sharing is prohibited
          </p>
        </div>
      )}
    </div>
  );
}

// ── Floating watermark that moves every 8 seconds ─────────────────────────────

function WatermarkOverlay({ text }: { text: string }) {
  const [position, setPosition] = useState({ top: "10%", left: "10%" });

  useEffect(() => {
    function randomPos() {
      const top = Math.floor(Math.random() * 70) + 5;
      const left = Math.floor(Math.random() * 60) + 5;
      setPosition({ top: `${top}%`, left: `${left}%` });
    }

    randomPos();
    const interval = setInterval(randomPos, 8000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div
      className="absolute pointer-events-none select-none transition-all duration-1000"
      style={{
        top: position.top,
        left: position.left,
        zIndex: 10,
      }}
    >
      <p
        className="text-white text-xs font-medium px-2 py-1 rounded"
        style={{
          opacity: 0.35,
          background: "rgba(0,0,0,0.3)",
          textShadow: "0 1px 2px rgba(0,0,0,0.8)",
          whiteSpace: "nowrap",
        }}
      >
        {text}
      </p>
    </div>
  );
}
