"use client";

import { useEffect, useRef, useState } from "react";

interface StreamData {
  embedUrl: string;
  title: string;
  levelName: string;
  watermark: string;
}

type State = "loading" | "ready" | "error" | "denied";

export default function PlayerClient({ videoId }: { videoId: string }) {
  const [state, setState] = useState<State>("loading");
  const [streamData, setStreamData] = useState<StreamData | null>(null);
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    const tg = (window as unknown as {
      Telegram?: { WebApp?: { initData: string; expand: () => void; ready: () => void } }
    }).Telegram?.WebApp;

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

    fetch(`/api/stream/${videoId}`, {
      headers: { Authorization: `tma ${initData}` },
    })
      .then(async (res) => {
        if (res.status === 403) { setState("denied"); return; }
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
          <p className="text-gray-400 text-sm">You are not enrolled in this level.</p>
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
      {/* Bunny embed iframe */}
      <div className="relative w-full" style={{ aspectRatio: "16/9" }}>
        <iframe
          src={streamData!.embedUrl}
          className="absolute inset-0 w-full h-full"
          allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture"
          allowFullScreen
          title={streamData!.title}
        />
        {/* Floating watermark */}
        {streamData && <WatermarkOverlay text={streamData.watermark} />}
      </div>

      {/* Info */}
      <div className="px-4 py-3 bg-gray-950 flex-1">
        <p className="text-white font-semibold text-base">{streamData!.title}</p>
        <p className="text-gray-400 text-sm mt-0.5">📘 {streamData!.levelName}</p>
        <p className="text-gray-600 text-xs mt-3">
          🔒 Licensed to {streamData!.watermark} · Sharing is prohibited
        </p>
      </div>
    </div>
  );
}

function WatermarkOverlay({ text }: { text: string }) {
  const [position, setPosition] = useState({ top: "10%", left: "10%" });

  useEffect(() => {
    function randomPos() {
      setPosition({
        top: `${Math.floor(Math.random() * 70) + 5}%`,
        left: `${Math.floor(Math.random() * 60) + 5}%`,
      });
    }
    randomPos();
    const interval = setInterval(randomPos, 8000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="absolute pointer-events-none select-none transition-all duration-1000"
      style={{ top: position.top, left: position.left, zIndex: 10 }}>
      <p className="text-white text-xs font-medium px-2 py-1 rounded"
        style={{ opacity: 0.35, background: "rgba(0,0,0,0.3)", whiteSpace: "nowrap" }}>
        {text}
      </p>
    </div>
  );
}
