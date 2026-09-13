import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "FNM — Food Near Me",
  description: "A simple and effective way to find food near you.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}