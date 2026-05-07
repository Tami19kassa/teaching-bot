"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface Video {
  id: number;
  title: string;
  description: string | null;
  bunnyVideoId: string;
  sortOrder: number;
}

interface Level {
  id: number;
  name: string;
  description: string | null;
  price: string | number;
  isActive: boolean;
  videos: Video[];
  _count: { userLevels: number };
}

export default function LevelManager({ initialLevels }: { initialLevels: Level[] }) {
  const router = useRouter();
  const [showNewLevel, setShowNewLevel] = useState(false);
  const [newLevel, setNewLevel] = useState({ name: "", description: "", price: "" });
  const [expandedLevel, setExpandedLevel] = useState<number | null>(null);
  const [newVideo, setNewVideo] = useState({ title: "", description: "", bunnyVideoId: "", sortOrder: 0 });
  const [loading, setLoading] = useState(false);
  const [videoError, setVideoError] = useState("");

  async function createLevel() {
    if (!newLevel.name || !newLevel.price) return;
    setLoading(true);
    const res = await fetch("/api/admin/levels", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newLevel),
    });
    if (res.ok) {
      setShowNewLevel(false);
      setNewLevel({ name: "", description: "", price: "" });
      router.refresh();
    }
    setLoading(false);
  }

  async function addVideo(levelId: number) {
    if (!newVideo.title || !newVideo.bunnyVideoId) return;
    setLoading(true);
    setVideoError("");
    const res = await fetch(`/api/admin/levels/${levelId}/videos`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newVideo),
    });
    if (res.ok) {
      setNewVideo({ title: "", description: "", bunnyVideoId: "", sortOrder: 0 });
      router.refresh();
    } else {
      const data = await res.json();
      setVideoError(data.error ?? "Failed to add video");
    }
    setLoading(false);
  }

  async function deleteVideo(levelId: number, videoId: number) {
    if (!confirm("Delete this video?")) return;
    await fetch(`/api/admin/levels/${levelId}/videos?videoId=${videoId}`, { method: "DELETE" });
    router.refresh();
  }

  return (
    <div className="space-y-4">
      {/* Create level button */}
      <div className="flex justify-end">
        <button
          onClick={() => setShowNewLevel(!showNewLevel)}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
        >
          + New Level
        </button>
      </div>

      {/* New level form */}
      {showNewLevel && (
        <div className="bg-white border border-blue-200 rounded-xl p-4 space-y-3">
          <h3 className="font-semibold text-gray-900">Create New Level</h3>
          <div className="grid grid-cols-2 gap-3">
            <input
              placeholder="Level name *"
              value={newLevel.name}
              onChange={(e) => setNewLevel({ ...newLevel, name: e.target.value })}
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
            />
            <input
              placeholder="Price (e.g. 29.99) *"
              type="number"
              value={newLevel.price}
              onChange={(e) => setNewLevel({ ...newLevel, price: e.target.value })}
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
            />
          </div>
          <input
            placeholder="Description (optional)"
            value={newLevel.description}
            onChange={(e) => setNewLevel({ ...newLevel, description: e.target.value })}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
          />
          <div className="flex gap-2">
            <button onClick={createLevel} disabled={loading}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
              Create Level
            </button>
            <button onClick={() => setShowNewLevel(false)}
              className="text-sm text-gray-500 hover:text-gray-700 px-3">
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Level cards */}
      {initialLevels.map((level) => (
        <div key={level.id} className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div
            className="flex items-center justify-between p-4 cursor-pointer hover:bg-gray-50"
            onClick={() => setExpandedLevel(expandedLevel === level.id ? null : level.id)}
          >
            <div className="flex items-center gap-3">
              <span className="text-lg">📘</span>
              <div>
                <p className="font-semibold text-gray-900">{level.name}</p>
                <p className="text-xs text-gray-400">
                  ${level.price} · {level._count.userLevels} enrolled · {level.videos.length} videos
                </p>
              </div>
            </div>
            <span className="text-gray-400 text-sm">{expandedLevel === level.id ? "▲" : "▼"}</span>
          </div>

          {expandedLevel === level.id && (
            <div className="border-t border-gray-100 p-4 space-y-4">
              {/* Existing videos */}
              {level.videos.length > 0 ? (
                <div className="space-y-2">
                  <p className="text-sm font-medium text-gray-700">Videos</p>
                  {level.videos.map((video) => (
                    <div key={video.id}
                      className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2">
                      <div>
                        <p className="text-sm font-medium text-gray-800">{video.title}</p>
                        <p className="text-xs text-gray-400 font-mono">
                          Bunny ID: {video.bunnyVideoId}
                        </p>
                      </div>
                      <button onClick={() => deleteVideo(level.id, video.id)}
                        className="text-red-400 hover:text-red-600 text-xs ml-3">
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-400">No videos yet.</p>
              )}

              {/* Add video form */}
              <div className="border border-dashed border-gray-200 rounded-lg p-3 space-y-2">
                <p className="text-sm font-medium text-gray-700">Add Video from Bunny Stream</p>
                <p className="text-xs text-gray-400">
                  Upload the video in your{" "}
                  <a href="https://dash.bunny.net/stream/655263" target="_blank"
                    className="text-blue-500 underline">Bunny Stream library</a>,
                  then paste the Video GUID here.
                </p>
                <input
                  placeholder="Video title *"
                  value={newVideo.title}
                  onChange={(e) => setNewVideo({ ...newVideo, title: e.target.value })}
                  className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                />
                <input
                  placeholder="Bunny Video GUID (e.g. a1b2c3d4-e5f6-...) *"
                  value={newVideo.bunnyVideoId}
                  onChange={(e) => setNewVideo({ ...newVideo, bunnyVideoId: e.target.value })}
                  className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-300"
                />
                <input
                  placeholder="Description (optional)"
                  value={newVideo.description}
                  onChange={(e) => setNewVideo({ ...newVideo, description: e.target.value })}
                  className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                />
                {videoError && (
                  <p className="text-red-500 text-xs">{videoError}</p>
                )}
                <button
                  onClick={() => addVideo(level.id)}
                  disabled={loading || !newVideo.title || !newVideo.bunnyVideoId}
                  className="bg-blue-600 text-white px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
                >
                  {loading ? "Verifying..." : "Add Video"}
                </button>
              </div>
            </div>
          )}
        </div>
      ))}

      {initialLevels.length === 0 && (
        <div className="text-center py-16 text-gray-400">
          <p className="text-4xl mb-3">📚</p>
          <p>No levels yet. Create your first one!</p>
        </div>
      )}
    </div>
  );
}
