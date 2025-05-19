import { EnvVarWarning } from "@/components/env-var-warning";
import HeaderAuth from "@/components/header-auth";
import { ThemeSwitcher } from "@/components/theme-switcher";
import { PushNotificationToggle } from "@/components/push-notification-toggle";
import { hasEnvVars } from "@/utils/supabase/check-env-vars";
import { Geist } from "next/font/google";
import { ThemeProvider } from "next-themes";
import Link from "next/link";
import { Toaster } from "sonner";
import "./globals.css";

const defaultUrl = process.env.VERCEL_URL
  ? `https://${process.env.VERCEL_URL}`
  : "http://localhost:3000";

export const metadata = {
  metadataBase: new URL(defaultUrl),
  title: "Wedding Pro - Professional Wedding Planning",
  description: "Professional wedding planning and management application",
  manifest: "/manifest.json",
  themeColor: "#000000",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Wedding Pro",
  },
  viewport: {
    width: "device-width",
    initialScale: 1,
    maximumScale: 1,
    userScalable: false,
  },
};

const geistSans = Geist({
  display: "swap",
  subsets: ["latin"],
});

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={geistSans.className} suppressHydrationWarning>
      <head>
        <script src="/sw-register.js" defer />
      </head>
      <body className="bg-background text-foreground">
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          {/* Transparent header for landing page */}
          <nav className="absolute top-0 left-0 right-0 z-50 flex justify-center h-16">
            <div className="w-full max-w-7xl flex justify-between items-center p-3 px-5 text-sm">
              <div className="flex gap-5 items-center">
                <Link href={"/"} className="text-white font-semibold text-xl">
                  Wedding Pro
                </Link>
              </div>
              <div className="flex items-center gap-4">
                <PushNotificationToggle />
                {!hasEnvVars ? <EnvVarWarning /> : <HeaderAuth />}
                <ThemeSwitcher />
              </div>
            </div>
          </nav>

          {/* Main content */}
          <main className="min-h-screen flex flex-col">
            {children}
          </main>

          {/* Footer */}
          <footer className="w-full flex items-center justify-center border-t mx-auto text-center text-xs gap-8 py-8">
            <p>
              © {new Date().getFullYear()} Wedding Pro Manager. All rights reserved.
            </p>
          </footer>
          
          <Toaster position="top-right" richColors />
        </ThemeProvider>
      </body>
    </html>
  );
}
