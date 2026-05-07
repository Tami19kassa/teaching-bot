import { Metadata } from "next";
import PlayerClient from "./PlayerClient";

export const metadata: Metadata = {
  title: "Video Player",
  robots: { index: false, follow: false },
};

export default function PlayerPage({ params }: { params: { videoId: string } }) {
  return <PlayerClient videoId={params.videoId} />;
}
