import Script from "next/script";
import PlayerClient from "./PlayerClient";

export const metadata = {
  title: "Video Player",
  robots: { index: false, follow: false },
};

export default function PlayerPage({ params }: { params: { videoId: string } }) {
  return (
    <>
      {/* Telegram Mini App SDK — must load before PlayerClient runs */}
      <Script
        src="https://telegram.org/js/telegram-web-app.js"
        strategy="beforeInteractive"
      />
      <PlayerClient videoId={params.videoId} />
    </>
  );
}
