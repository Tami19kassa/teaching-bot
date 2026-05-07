import { prisma } from "@/lib/prisma";
import LevelManager from "@/components/LevelManager";

export const dynamic = "force-dynamic";

export default async function LevelsPage() {
  const levels = await prisma.level.findMany({
    include: {
      videos: { orderBy: { sortOrder: "asc" } },
      _count: { select: { userLevels: true } },
    },
    orderBy: { id: "asc" },
  });

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Levels & Content</h1>
        <p className="text-gray-500 text-sm mt-1">
          Manage learning levels and link video IDs
        </p>
      </div>
      <LevelManager initialLevels={JSON.parse(JSON.stringify(levels))} />
    </div>
  );
}
