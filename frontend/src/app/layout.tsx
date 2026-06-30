import type { Metadata } from "next";
import { Outfit, Inter } from "next/font/google";
import "./globals.css";

const outfit = Outfit({
  subsets: ["latin"],
  variable: "--font-outfit",
  display: "swap",
});

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Baro Platform",
  description:
    "AI learning platform that converts lecture videos into structured Somali study notes.",
  icons: {
    icon: [{ url: "/barobadi-logo.png", type: "image/png" }],
    shortcut: "/barobadi-logo.png",
    apple: "/barobadi-logo.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${outfit.variable} ${inter.variable}`} suppressHydrationWarning>
      <head>
        <script
          id="theme-initializer"
          dangerouslySetInnerHTML={{
            __html: `
              (function () {
                try {
                  var saved = window.localStorage.getItem("public-theme") || window.localStorage.getItem("theme");
                  var theme = saved === "dark" || saved === "light" ? saved : (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
                  document.documentElement.dataset.theme = theme;
                } catch (e) {}
              })();
            `
          }}
        />
      </head>
      <body>
        {children}
      </body>
    </html>
  );
}

