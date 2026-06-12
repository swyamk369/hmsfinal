import './globals.css';
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { AuthProvider } from '@/lib/auth-context';
import { ToastProvider } from '@/components/toast';
import { AiChatbot } from '@/components/shared/ai-chatbot';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter', display: 'swap' });

export const metadata: Metadata = {
  title: 'HMS — Hospital Management System',
  description: 'Multi-tenant hospital operating system',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="font-sans">
        <AuthProvider>
          <ToastProvider>
            {children}
            <AiChatbot />
          </ToastProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
