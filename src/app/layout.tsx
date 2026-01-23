import type { Metadata } from "next";
import "./globals.css";
import Providers from "../redux/Providers";
import Header from "@/components/HomeLayout/Header";
import Footer from "@/components/HomeLayout/Footer";
import AuthListener from "./AuthListener";


export const metadata: Metadata = {
  title: "PayNow",
  description: "Pay bills Instantly",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="min-h-screen flex flex-col">
        <Providers>
          <AuthListener />
          <Header />
          <main className="flex-1">{children}</main>
          <Footer />
        </Providers>
      </body>
    </html>
  );
}
