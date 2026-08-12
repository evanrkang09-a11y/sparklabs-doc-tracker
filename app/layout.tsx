import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { LangProvider } from "./lang-provider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "서류 취합 트래커 · SparkLabs Korea",
  description: "투자 전 제출 서류 관리 및 서류 실사 체크리스트",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // lang="ko" matches what the server renders; the language switcher updates
    // it on the client when someone flips to English.
    <html
      lang="ko"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <LangProvider>{children}</LangProvider>
      </body>
    </html>
  );
}
