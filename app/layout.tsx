import type {Metadata} from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Playwright Studio',
  description:
    'Build real browser tests by snapping blocks together, then run them with Playwright.',
  openGraph: {
    title: 'Playwright Studio',
    description:
      'Build real browser tests by snapping blocks together, then run them with Playwright.',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Playwright Studio',
    description:
      'Build real browser tests by snapping blocks together, then run them with Playwright.',
  },
};

export default function RootLayout({children}: {children: React.ReactNode}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Resolve theme before first paint: stored choice, else OS preference. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var s=localStorage.getItem('studio-theme');var d=s?s==='dark':window.matchMedia('(prefers-color-scheme: dark)').matches;document.documentElement.classList.toggle('dark',d);}catch(e){}})();`,
          }}
        />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600&family=Plus+Jakarta+Sans:wght@500;600;700&family=Public+Sans:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body
        className="bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100 antialiased selection:bg-blue-600 selection:text-white"
        suppressHydrationWarning
      >
        {children}
      </body>
    </html>
  );
}
