import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/contexts/auth-context";
import { DevIndicatorRemover } from "@/components/dev-indicator-remover";
import { Toaster } from 'sonner';

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "FIONA",
  description: "Authentication Capture Platform",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" style={{ height: '100%' }}>
      <body 
        className={inter.className}
        style={{ 
          height: '100%',
          margin: 0,
          padding: 0,
          backgroundColor: '#0C0E14',
          color: '#E2E8F0',
        }}
      >
        <DevIndicatorRemover />
        <AuthProvider>
          {children}
        </AuthProvider>
        <Toaster position="top-right" richColors />
      </body>
    </html>
  );
}
