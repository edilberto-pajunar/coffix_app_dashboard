import type { Metadata } from "next";
import { Toaster } from "sonner";
import { AuthProvider } from "@/app/lib/AuthContext";
import "./globals.css";


export const metadata: Metadata = {
  title: "Coffix Dashboard",
  description: "Coffee shop operations dashboard",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <AuthProvider>
          {children}
        </AuthProvider>
        <Toaster richColors position="top-right" />
      </body>
    </html>
  );
}

