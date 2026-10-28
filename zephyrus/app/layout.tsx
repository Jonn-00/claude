import type { Metadata, Viewport } from "next";
import "./globals.css";
import { AppShell } from "@/components/shell/app-shell";

export const metadata: Metadata = {
  title: "Zephyrus",
  description: "Your YouTube channels and AI ad agency, in one day.",
  icons: { icon: "/icon.svg" },
};

export const viewport: Viewport = {
  themeColor: "#0d0907",
  colorScheme: "dark",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
