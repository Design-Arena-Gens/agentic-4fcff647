import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "React Three Runner",
  description: "Simple web game built with React and Three.js"
};

export default function RootLayout({
  children
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fa">
      <body>{children}</body>
    </html>
  );
}
