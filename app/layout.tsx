import type { Metadata, Viewport } from 'next';
import { Frank_Ruhl_Libre, DM_Sans } from 'next/font/google';
import './globals.css';

const frankRuhlLibre = Frank_Ruhl_Libre({
  subsets: ['latin'],
  variable: '--font-frank-ruhl',
  display: 'swap',
  weight: ['400', '500', '700'],
});

const dmSans = DM_Sans({
  subsets: ['latin'],
  variable: '--font-dm-sans',
  display: 'swap',
  weight: ['400', '500', '700'],
});

export const metadata: Metadata = {
  title: 'Crabcake Classic',
  description: 'Golf scoring app for the annual Crabcake Classic - Team Brown vs Team Rusty',
  manifest: '/manifest.json',
  icons: {
    icon: '/Crabcake_Classic_Logo.png',
    apple: '/Crabcake_Classic_Logo.png',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#006747',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${frankRuhlLibre.variable} ${dmSans.variable}`}>
      <body className="font-sans bg-masters-cream min-h-screen text-masters-black">
        {/* Header */}
        <header className="bg-masters-green sticky top-0 z-50 shadow-md">
          <div className="max-w-lg mx-auto px-4 py-3 flex items-center justify-center gap-3">
            <a href="/" className="flex items-center gap-3">
              <img
                src="/Crabcake_Classic_Logo.png"
                alt="Crabcake Classic"
                className="h-10 w-10 rounded-lg object-cover"
              />
              <div className="text-center">
                <h1 className="text-xl font-serif font-bold text-white tracking-wide">
                  CRABCAKE CLASSIC
                </h1>
                <p className="text-masters-gold text-xs font-medium tracking-wider">
                  PINEHURST 2026
                </p>
              </div>
            </a>
          </div>
        </header>

        {/* Main Content */}
        <main className="max-w-4xl mx-auto px-4 py-6">
          {children}
        </main>

        {/* Footer */}
        <footer className="bg-masters-green text-white py-4 mt-auto">
          <div className="max-w-4xl mx-auto px-4 text-center text-sm opacity-75">
            <p>Team Brown vs Team Rusty</p>
          </div>
        </footer>
      </body>
    </html>
  );
}
