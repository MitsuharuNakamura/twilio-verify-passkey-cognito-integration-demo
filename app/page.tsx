import Link from "next/link";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 p-8">
      <h1 className="text-4xl font-bold">Passkey Auth</h1>
      <p className="text-lg text-gray-600">
        パスキーで安全にログインできるアプリケーション
      </p>
      <div className="flex gap-4">
        <Link
          href="/register"
          className="rounded-lg bg-blue-600 px-6 py-3 text-white hover:bg-blue-700"
        >
          アカウント作成
        </Link>
        <Link
          href="/login"
          className="rounded-lg border border-gray-300 px-6 py-3 hover:bg-gray-100"
        >
          ログイン
        </Link>
      </div>
    </main>
  );
}
