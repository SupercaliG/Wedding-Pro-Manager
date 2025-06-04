import { EnvVarWarning } from "@/components/env-var-warning";
import HeaderAuth from "@/components/header-auth";
import { ThemeSwitcher } from "@/components/theme-switcher";
import { PushNotificationToggle } from "@/components/push-notification-toggle";
import { hasEnvVars } from "@/utils/supabase/check-env-vars"; // Keep for reference, but TopGlobalNav handles its usage
import TopGlobalNav from "@/components/top-global-nav"; // Import the new component
import { Geist } from "next/font/google";
import { ThemeProvider } from "next-themes";
import Link from "next/link"; // Keep for Wedding Pro link if TopGlobalNav doesn't include it, but it does
import { Toaster } from "sonner";
import "./globals.css";

const defaultUrl = process.env.VERCEL_URL
  ? `https://${process.env.VERCEL_URL}`
  : "http://localhost:3000";

console.log("[Layout] defaultUrl:", defaultUrl);

export const metadata = {
  metadataBase: new URL(defaultUrl),
  icons: {
    icon: 'http://localhost:3000/favicon.ico',
  },
  title: "Wedding Pro - Professional Wedding Planning",
  description: "Professional wedding planning and management application",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Wedding Pro",
    // Note: Ensure there's a comma above if this was the last property before appleWebApp
  },
};

export const viewport = {
  themeColor: "#000000",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
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
        {/* <script src="/sw-register.js" defer /> */}
      </head>
      <body className="bg-background text-foreground" suppressHydrationWarning={true}>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <TopGlobalNav />

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
