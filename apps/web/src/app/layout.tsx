import './globals.css';
import type { Metadata } from 'next';
import { AuthProvider } from '@/lib/auth-context';
import { ToastProvider } from '@/components/toast';
import { AiChatbot } from '@/components/shared/ai-chatbot';

export const metadata: Metadata = {
  title: 'HMS — Hospital Management System',
  description: 'Multi-tenant hospital operating system',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
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
