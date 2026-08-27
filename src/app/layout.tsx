import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Solana Number Draw',
  description: 'Choose your number, win SOL prizes. A provably fair number draw game on Solana.',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Number Draw',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#0E0E1A',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <head>
        {/* Telegram WebApp SDK */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              if (window.Telegram && window.Telegram.WebApp) {
                window.Telegram.WebApp.ready();
                window.Telegram.WebApp.expand();
              }
            `,
          }}
        />
        <script src="https://telegram.org/js/telegram-web-app.js" async />
      </head>
      <body className="min-h-screen bg-solana-darker text-white antialiased">
        <div className="telegram-safe-area">
          <main className="max-w-lg mx-auto min-h-screen flex flex-col">
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}
