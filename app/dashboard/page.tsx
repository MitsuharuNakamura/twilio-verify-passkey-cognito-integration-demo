"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function DashboardPage() {
  const router = useRouter();
  const [loggingOut, setLoggingOut] = useState(false);

  async function handleLogout() {
    setLoggingOut(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      router.push("/login");
    } catch {
      setLoggingOut(false);
    }
  }

  return (
    <main className="min-h-screen p-8">
      <div className="mx-auto max-w-2xl">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-bold">Dashboard</h1>
          <button
            onClick={handleLogout}
            disabled={loggingOut}
            className="rounded-lg border border-gray-300 px-4 py-2 hover:bg-gray-100 disabled:opacity-50"
          >
            {loggingOut ? "ログアウト中..." : "ログアウト"}
          </button>
        </div>

        <div className="rounded-xl bg-white p-6 shadow-lg">
          <h2 className="text-xl font-semibold mb-4">
            ようこそ！
          </h2>
          <p className="text-gray-600">
            パスキー認証でログインに成功しました。
            このページは認証済みユーザーのみアクセスできます。
          </p>
        </div>
      </div>
    </main>
  );
}
