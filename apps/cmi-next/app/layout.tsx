import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import { ServiceWorkerRegister } from "@/components/pwa/service-worker-register";

export const metadata: Metadata = {
  title: "Constructed Matter",
  description: "Constructed Matter website and project dashboard.",
  applicationName: "Constructed Matter",
  appleWebApp: {
    capable: true,
    title: "CMI",
    statusBarStyle: "black-translucent",
  },
  icons: {
    icon: [
      { url: "/brand/cmi-favicon-black.png", media: "(prefers-color-scheme: light)" },
      { url: "/brand/cmi-favicon-white.png", media: "(prefers-color-scheme: dark)" },
    ],
    shortcut: "/brand/cmi-favicon-black.png",
    apple: "/icons/apple-touch-icon.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#111113",
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `try{var t=localStorage.getItem("cmi-theme");var d=t?t==="dark":window.matchMedia("(prefers-color-scheme: dark)").matches;document.documentElement.classList.toggle("dark",d);document.documentElement.dataset.theme=d?"dark":"light";}catch(e){}`,
          }}
        />
      </head>
      <body>
        {children}
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
