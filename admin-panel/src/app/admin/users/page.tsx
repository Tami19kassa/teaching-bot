import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function UsersPage() {
  const users = await prisma.user.findMany({
    include: {
      userLevels: { include: { level: true } },
      _count: { select: { payments: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Users</h1>
        <p className="text-gray-500 text-sm mt-1">
          {users.length} registered users
        </p>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-gray-600">User</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Telegram ID</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Enrolled Levels</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Payments</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Joined</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {users.map((user) => (
              <tr key={user.id} className="hover:bg-gray-50">
                <td className="px-4 py-3">
                  <p className="font-medium text-gray-900">
                    {user.firstName} {user.lastName ?? ""}
                  </p>
                  {user.username && (
                    <p className="text-xs text-gray-400">@{user.username}</p>
                  )}
                </td>
                <td className="px-4 py-3 text-gray-500 font-mono text-xs">
                  {user.telegramId.toString()}
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-1">
                    {user.userLevels.length === 0 ? (
                      <span className="text-gray-400 text-xs">None</span>
                    ) : (
                      user.userLevels.map((ul) => (
                        <span
                          key={ul.id}
                          className="bg-blue-50 text-blue-700 text-xs px-2 py-0.5 rounded-full"
                        >
                          {ul.level.name}
                        </span>
                      ))
                    )}
                  </div>
                </td>
                <td className="px-4 py-3 text-gray-500">
                  {user._count.payments}
                </td>
                <td className="px-4 py-3 text-gray-400 text-xs">
                  {new Date(user.createdAt).toLocaleDateString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {users.length === 0 && (
          <div className="text-center py-16 text-gray-400">
            <p className="text-4xl mb-3">👥</p>
            <p>No users yet.</p>
          </div>
        )}
      </div>
    </div>
  );
}
