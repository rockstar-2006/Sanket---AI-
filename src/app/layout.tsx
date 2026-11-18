// Sanket AI Next.js App Root Layout
import type { Metadata, Viewport } from 'next';
import { Plus_Jakarta_Sans, Inter, Dancing_Script } from 'next/font/google';
import './globals.css';
import { AuthProvider } from '@/context/AuthContext';
import { WalletProvider } from '@/context/WalletContext';
import { RechargeModal } from '@/components/payment/RechargeModal';
import { PwaInstallPrompt } from '@/components/pwa/PwaInstallPrompt';
import { PageTransitionProvider } from '@/components/layout/PageTransitionProvider';

const plusJakartaSans = Plus_Jakarta_Sans({
  subsets: ['latin'],
  variable: '--font-heading',
  display: 'swap',
  fallback: ['system-ui', 'sans-serif'],
});

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-body',
  display: 'swap',
  fallback: ['system-ui', 'sans-serif'],
});

const dancingScript = Dancing_Script({
  subsets: ['latin'],
  variable: '--font-cursive',
  display: 'swap',
  fallback: ['cursive', 'sans-serif'],
});

export const viewport: Viewport = {
  themeColor: '#0f172a',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
};

export const metadata: Metadata = {
  title: 'Sanket AI - Accessible Video Meeting Platform',
  description: 'AI-powered live video meeting platform with on-device Indian Sign Language recognition and real-time speech subtitles.',
  manifest: '/manifest.json',
  icons: {
    icon: [
      { url: '/icons/icon.svg', type: 'image/svg+xml' },
      { url: '/icons/icon-192x192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icons/icon-512x512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: [
      { url: '/icons/apple-touch-icon.png', sizes: '180x180', type: 'image/png' },
    ],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Sanket AI',
  },
  applicationName: 'Sanket AI',
  formatDetection: {
    telephone: false,
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" data-scroll-behavior="smooth" className={`${plusJakartaSans.variable} ${inter.variable} ${dancingScript.variable}`}>
      <head>
        <link rel="manifest" href="/manifest.json" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="Sanket AI" />
      </head>
      <body className="min-h-screen flex flex-col bg-slate-50 text-slate-900 font-sans antialiased">
        <AuthProvider>
          <WalletProvider>
            <PageTransitionProvider>
              {children}
            </PageTransitionProvider>
            <RechargeModal />
            <PwaInstallPrompt />
          </WalletProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
