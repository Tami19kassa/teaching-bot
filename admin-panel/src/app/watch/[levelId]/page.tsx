import { Metadata } from "next";
import WatchPageClient from "./WatchPageClient";

export const metadata: Metadata = {
  title: "Watch Videos",
  // Prevent search engine indexing of protected content pages
  robots: { index: false, follow: false },
};

export default function WatchPage({ params }: { params: { levelId: string } }) {
  const levelId = parseInt(params.levelId, 10);
  const botUsername = process.env.NEXT_PUBLIC_BOT_USERNAME ?? "";

  return (
    <WatchPageClient
      levelId={levelId}
      botUsername={botUsername}
    />
  );
}
