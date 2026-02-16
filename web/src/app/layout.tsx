import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { Providers } from '@/components/Providers';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';

const inter = Inter({ subsets: ['latin'], variable: '--font-geist-sans' });

export const metadata: Metadata = {
  title: { default: 'Digit Properties | Buy, Sell, Rent Properties in Nigeria', template: '%s | Digit Properties' },
  description:
    'Find your dream property in Nigeria. Browse apartments, houses, land, and commercial properties for sale and rent. Lagos, Abuja, Port Harcourt and more.',
  keywords: ['real estate', 'Nigeria', 'property', 'buy', 'sell', 'rent', 'Lagos', 'Abuja', 'properties'],
  openGraph: {
    title: 'Digit Properties | Buy, Sell, Rent in Nigeria',
    description: 'Nigeria\'s premier real estate platform. Find apartments, houses, land for sale and rent.',
    url: 'https://digitproperties.com',
    siteName: 'Digit Properties',
    locale: 'en_NG',
  },
  twitter: { card: 'summary_large_image', title: 'Digit Properties | Nigeria Real Estate' },
  robots: { index: true, follow: true },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="min-h-screen bg-gray-50 text-gray-900 antialiased">
        <Providers>
          <div className="flex min-h-screen flex-col">
            <Header />
            <main className="flex-1">{children}</main>
            <Footer />
          </div>
        </Providers>
      </body>
    </html>
  );
}
