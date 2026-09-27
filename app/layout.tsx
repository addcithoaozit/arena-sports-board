import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "YJ體育分析",
  description: "MLB、CPBL、NPB、KBO 即時賽事、賽前分析。",
  icons: {
    icon: "/yj-app-icon.png",
    shortcut: "/yj-app-icon.png",
    apple: "/apple-touch-icon.png?v=20260927-2",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-Hant">
      <body className="antialiased">{children}</body>
    </html>
  );
}
