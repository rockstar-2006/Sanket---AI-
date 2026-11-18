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
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || 'https://sanket-ai.onrender.com'),
  title: 'Sanket AI - Accessible Video Meeting Platform',
  description: 'AI-powered live video meeting platform with on-device Indian Sign Language recognition, real-time speech subtitles, and 3D interpreter avatar.',
  manifest: '/manifest.json?v=2',
  icons: {
    icon: [
      { url: '/icons/icon.svg?v=2', type: 'image/svg+xml' },
      { url: '/icons/icon-192x192.png?v=2', sizes: '192x192', type: 'image/png' },
      { url: '/icons/icon-512x512.png?v=2', sizes: '512x512', type: 'image/png' },
    ],
    apple: [
      { url: '/icons/apple-touch-icon.png?v=2', sizes: '180x180', type: 'image/png' },
    ],
  },
  openGraph: {
    title: 'Sanket AI - Accessible Video Meetings & ISL Interpreter',
    description: 'AI-powered live video meetings with Indian Sign Language recognition, live speech subtitles, and 3D avatar interpreter. Accessible for everyone.',
    url: '/',
    siteName: 'Sanket AI',
    images: [
      {
        url: '/opengraph-image',
        width: 1200,
        height: 630,
        alt: 'Sanket AI - Accessible Video Meetings',
      },
    ],
    locale: 'en_IN',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Sanket AI - Accessible Video Meetings',
    description: 'AI-powered live video meetings with Indian Sign Language recognition and live speech subtitles.',
    images: ['/opengraph-image'],
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
        <link rel="manifest" href="/manifest.json?v=2" />
        <link rel="icon" href="/icons/icon.svg?v=2" type="image/svg+xml" />
        <link rel="apple-touch-icon" href="/icons/apple-touch-icon.png?v=2" />
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
