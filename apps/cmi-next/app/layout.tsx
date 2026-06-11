import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "Constructed Matter",
  description: "Constructed Matter website and project dashboard.",
  icons: {
    icon: [
      { url: "/brand/cmi-favicon-black.png", media: "(prefers-color-scheme: light)" },
      { url: "/brand/cmi-favicon-white.png", media: "(prefers-color-scheme: dark)" },
    ],
    shortcut: "/brand/cmi-favicon-black.png",
    apple: "/brand/cmi-favicon-black.png",
  },
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
      <body>{children}</body>
    </html>
  );
}
