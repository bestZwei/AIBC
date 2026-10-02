import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'AIBC · 个人 AI 电台',
  description: '连续、被动、可插话的个人 AI 广播电台。选一个频道，让 AI 为你不间断地播。',
};

// 首屏前应用主题，避免深浅色闪烁（FOUC）。
const themeBootstrap = `
try {
  var t = localStorage.getItem('aibc-theme');
  if (t === 'light') document.documentElement.classList.remove('dark');
  else document.documentElement.classList.add('dark');
} catch (e) {}
`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" className="dark" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBootstrap }} />
      </head>
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>{children}</body>
    </html>
  );
}
