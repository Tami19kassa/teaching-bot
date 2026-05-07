import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAdminAuthenticated } from "@/lib/auth";

/** GET /api/admin/levels — list all levels with their videos */
export async function GET() {
  if (!isAdminAuthenticated()) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const levels = await prisma.level.findMany({
    include: {
      videos: { orderBy: { sortOrder: "asc" } },
      _count: { select: { userLevels: true } },
    },
    orderBy: { id: "asc" },
  });

  return NextResponse.json(levels);
}

/** POST /api/admin/levels — create a new level */
export async function POST(request: Request) {
  if (!isAdminAuthenticated()) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { name, description, price } = body;

  if (!name || price === undefined) {
    return NextResponse.json({ error: "name and price are required" }, { status: 400 });
  }

  const level = await prisma.level.create({
    data: { name, description: description ?? null, price },
  });

  return NextResponse.json(level, { status: 201 });
}
