"use client";

import { useEffect, useRef, useState } from "react";

interface TelegramUser {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
  auth_date: number;
  hash: string;
}

interface Video {
  id: number;
  title: string;
  description: string | null;
  embedUrl: string;
  provider: string;
}

type AuthState = "idle" | "authenticating" | "checking" | "granted" | "denied" | "error";

export default function WatchPageClient({
  levelId,
  botUsername,
}: {
  levelId: number;
  botUsername: string;
}) {
  const [authState, setAuthState] = useState<AuthState>("idle");
  const [videos, setVideos] = useState<Video[]>([]);
  const [activeVideo, setActiveVideo] = useState<Video | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [token, setToken] = useState<string | null>(null);
  const telegramWidgetRef = useRef<HTMLDivElement>(null);

  // Mount the Telegram Login Widget
  useEffect(() => {
    if (!telegramWidgetRef.current || !botUsername) return;

    // Telegram widget injects a script that calls window.onTelegramAuth
    (window as unknown as Record<string, unknown>).onTelegramAuth = async (
      user: TelegramUser
    ) => {
      setAuthState("checking");
      try {
        const res = await fetch("/api/auth/telegram", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ telegramAuthData: user, levelId }),
        });

        const data = await res.json();

        if (!res.ok) {
          setAuthState("denied");
          setErrorMessage(data.error ?? "Access denied.");
          return;
        }

        setToken(data.token);
        setAuthState("granted");
      } catch {
        setAuthState("error");
        setErrorMessage("Network error. Please try again.");
      }
    };

    // Inject the Telegram widget script
    const script = document.createElement("script");
    script.src = "https://telegram.org/js/telegram-widget.js?22";
    script.setAttribute("data-telegram-login", botUsername);
    script.setAttribute("data-size", "large");
    script.setAttribute("data-onauth", "onTelegramAuth(user)");
    script.setAttribute("data-request-access", "write");
    script.async = true;

    telegramWidgetRef.current.appendChild(script);

    return () => {
      // Cleanup
      delete (window as unknown as Record<string, unknown>).onTelegramAuth;
    };
  }, [botUsername, levelId]);

  // Fetch videos once we have a token
  useEffect(() => {
    if (!token) return;

    fetch(`/api/videos/${levelId}?token=${encodeURIComponent(token)}`)
      .then((r) => r.json())
      .then((data: Video[]) => {
        setVideos(data);
        if (data.length > 0) setActiveVideo(data[0]);
      })
      .catch(() => {
        setAuthState("error");
        setErrorMessage("Failed to load videos.");
      });
  }, [token, levelId]);

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Header */}
      <header className="border-b border-gray-800 px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <h1 className="text-lg font-bold">🎓 Learning Portal</h1>
          {authState === "granted" && (
            <span className="text-xs text-green-400 bg-green-400/10 px-3 py-1 rounded-full">
              ✓ Access Verified
            </span>
          )}
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-6 py-8">
        {/* IDLE — show login widget */}
        {(authState === "idle" || authState === "authenticating") && (
          <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
            <div className="mb-8">
              <p className="text-5xl mb-4">🔐</p>
              <h2 className="text-2xl font-bold mb-2">Verify Your Access</h2>
              <p className="text-gray-400 max-w-md">
                This content is protected. Sign in with your Telegram account to
                verify your enrollment and access the videos.
              </p>
            </div>

            {/* Telegram Login Widget mounts here */}
            <div ref={telegramWidgetRef} className="flex justify-center" />

            <p className="text-xs text-gray-600 mt-6 max-w-sm">
              Your identity is verified using Telegram's secure login. We only
              check your enrollment status — no data is stored.
            </p>
          </div>
        )}

        {/* CHECKING */}
        {authState === "checking" && (
          <div className="flex flex-col items-center justify-center min-h-[60vh]">
            <div className="animate-spin text-4xl mb-4">⏳</div>
            <p className="text-gray-400">Verifying your access...</p>
          </div>
        )}

        {/* DENIED */}
        {authState === "denied" && (
          <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
            <p className="text-5xl mb-4">🚫</p>
            <h2 className="text-2xl font-bold mb-2 text-red-400">Access Denied</h2>
            <p className="text-gray-400 max-w-md mb-6">{errorMessage}</p>
            <p className="text-sm text-gray-500">
              If you've made a payment, please wait for admin approval.
              <br />
              Use the bot to check your status.
            </p>
          </div>
        )}

        {/* ERROR */}
        {authState === "error" && (
          <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
            <p className="text-5xl mb-4">⚠️</p>
            <h2 className="text-2xl font-bold mb-2 text-yellow-400">Something went wrong</h2>
            <p className="text-gray-400">{errorMessage}</p>
            <button
              onClick={() => window.location.reload()}
              className="mt-4 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700"
            >
              Try Again
            </button>
          </div>
        )}

        {/* GRANTED — show video player */}
        {authState === "granted" && videos.length > 0 && (
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            {/* Video player */}
            <div className="lg:col-span-3">
              {activeVideo && (
                <div>
                  <div className="relative w-full aspect-video bg-black rounded-xl overflow-hidden">
                    <iframe
                      src={activeVideo.embedUrl}
                      className="absolute inset-0 w-full h-full"
                      allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture"
                      allowFullScreen
                      title={activeVideo.title}
                    />
                  </div>
                  <div className="mt-4">
                    <h2 className="text-xl font-bold">{activeVideo.title}</h2>
                    {activeVideo.description && (
                      <p className="text-gray-400 mt-2 text-sm">{activeVideo.description}</p>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Playlist sidebar */}
            <div className="lg:col-span-1">
              <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-3">
                Playlist ({videos.length})
              </h3>
              <div className="space-y-2">
                {videos.map((video, index) => (
                  <button
                    key={video.id}
                    onClick={() => setActiveVideo(video)}
                    className={`w-full text-left px-3 py-3 rounded-lg transition-colors ${
                      activeVideo?.id === video.id
                        ? "bg-blue-600 text-white"
                        : "bg-gray-800 text-gray-300 hover:bg-gray-700"
                    }`}
                  >
                    <p className="text-xs text-gray-400 mb-0.5">
                      {activeVideo?.id === video.id ? "▶ " : `${index + 1}. `}
                    </p>
                    <p className="text-sm font-medium leading-tight">{video.title}</p>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {authState === "granted" && videos.length === 0 && (
          <div className="text-center py-16 text-gray-500">
            <p className="text-4xl mb-3">📭</p>
            <p>No videos have been added to this level yet.</p>
          </div>
        )}
      </div>
    </div>
  );
}
