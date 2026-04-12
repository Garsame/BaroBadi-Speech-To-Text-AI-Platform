import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Video Lecture to Somali Notes",
  description: "Educational AI platform that converts lecture videos into structured Somali study notes.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        {children}
      </body>
    </html>
  );
}
