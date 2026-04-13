import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Script from "next/script";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  interactiveWidget: "resizes-content",
};



export const metadata: Metadata = {
  title: "Tempted.Chat – Random Video & Text Chat with Strangers",
  description:
    "Tempted.Chat is a modern random chat platform where you can instantly meet and chat with strangers worldwide. Start anonymous text or image chats securely with Google login.",
  
  keywords: [
    "random chat",
    "chat with strangers",
    "omegle alternative",
    "anonymous chat",
    "random video chat",
    "online chat platform",
    "talk to strangers",
    "image chat",
    "tempted chat"
  ],

  authors: [{ name: "Tempted.Chat Team" }],

  openGraph: {
    title: "Tempted.Chat – Meet Strangers Instantly",
    description:
      "Connect with people around the world through random chats. Secure, fast, and anonymous conversations.",
    url: "https://tempted.chat",
    siteName: "Tempted.Chat",
    type: "website",
  },

  twitter: {
    card: "summary_large_image",
    title: "Tempted.Chat – Random Chat Platform",
    description:
      "Start chatting with strangers instantly. A modern alternative to Omegle.",
  },

  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <Script id="gtm-script" strategy="afterInteractive">
        {`(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
})(window,document,'script','dataLayer','GTM-N7MQ2L64');`}
      </Script>
      <Script
        src="https://www.google.com/recaptcha/api.js?render=explicit"
        strategy="afterInteractive"
        async
      />
      <body className="min-h-full flex flex-col">
        <noscript>
          <iframe
            src="https://www.googletagmanager.com/ns.html?id=GTM-N7MQ2L64"
            height="0"
            width="0"
            style={{ display: "none", visibility: "hidden" }}
          />
        </noscript>
        {children}
      </body>
    </html>
  );
}
