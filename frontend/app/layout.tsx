import type { Metadata } from "next";
import "geist/font/sans";
import "geist/font/mono";
import "@/styles/globals.css";
import { AuthProvider } from "@/components/auth/auth-provider";
import { AppProvider } from "@/components/common/app-provider";

export const metadata: Metadata = {
  title: { default: "Canvas Sweeper", template: "%s · Canvas Sweeper" },
  description: "Canvai turns Canvas deadlines into a realistic study plan.",
};

const themeScript = `(function(){try{var t=localStorage.getItem('canvas-sweeper:theme')||'light';var r=t==='system'?(matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'):t;document.documentElement.dataset.theme=r;document.documentElement.style.colorScheme=r}catch(e){}})()`;

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" data-scroll-behavior="smooth" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>
        <AuthProvider>
          <AppProvider>{children}</AppProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
