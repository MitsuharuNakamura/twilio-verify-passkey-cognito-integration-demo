import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Passkey Auth",
  description: "Passkey authentication with Twilio Verify and AWS Cognito",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ja">
      <body className="min-h-screen bg-gray-50 text-gray-900 antialiased">
        {children}
      </body>
    </html>
  );
}
