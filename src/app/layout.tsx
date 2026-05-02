// app/layout.tsx
import type { Metadata } from 'next';
import './globals.css';
import { AuthProvider } from '@/components/ui/AuthProvider';

export const metadata: Metadata = {
  title: 'PodPair — Real conversations, real people',
  description: 'Connect with strangers for meaningful podcast-style conversations.',
  viewport: 'width=device-width, initial-scale=1, maximum-scale=1',
  themeColor: '#0a0a0f',
  manifest: '/manifest.json',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-surface-0">
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
