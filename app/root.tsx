import {
  isRouteErrorResponse,
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  useNavigate,
} from "react-router";
import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";

import type { Route } from "./+types/root";
import "./app.css";

export const links: Route.LinksFunction = () => [
  { rel: "icon", type: "image/png", href: "/favicon.png" },
  { rel: "preconnect", href: "https://fonts.googleapis.com" },
  {
    rel: "preconnect",
    href: "https://fonts.gstatic.com",
    crossOrigin: "anonymous",
  },
  {
    rel: "stylesheet",
    href: "https://fonts.googleapis.com/css2?family=Inter:ital,opsz,wght@0,14..32,100..900;1,14..32,100..900&family=Noto+Serif+JP:wght@400;500;600;700&display=swap",
  },
];

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <Meta />
        <Links />
      </head>
      <body>
        {children}
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

export default function App() {
  const navigate = useNavigate();
  const [transitionPhase, setTransitionPhase] = useState<
    "blur" | "clear" | null
  >(null);
  const pendingNavigation = useRef<{ to: string; replace?: boolean } | null>(
    null
  );

  useEffect(() => {
    const handleNavigation = (event: Event) => {
      const detail = (event as CustomEvent).detail as {
        to: string;
        replace?: boolean;
      };
      pendingNavigation.current = detail;
      setTransitionPhase("blur");
    };

    window.addEventListener("page-transition:navigate", handleNavigation);
    return () =>
      window.removeEventListener("page-transition:navigate", handleNavigation);
  }, []);

  return (
    <>
      <Outlet />
      <AnimatePresence>
        {transitionPhase === "blur" && (
          <motion.div
            key="blur"
            aria-hidden="true"
            className="pointer-events-none fixed inset-0 z-[100] overflow-hidden"
            initial={{ backdropFilter: "blur(0px)" }}
            animate={{ backdropFilter: "blur(30px)" }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            onAnimationComplete={() => {
              const pending = pendingNavigation.current;
              if (!pending) return;
              pendingNavigation.current = null;
              navigate(pending.to, { replace: pending.replace });
              setTransitionPhase("clear");
            }}
          />
        )}
        {transitionPhase === "clear" && (
          <motion.div
            key="clear"
            aria-hidden="true"
            className="pointer-events-none fixed inset-0 z-[100]"
            initial={{ backdropFilter: "blur(30px)" }}
            animate={{ backdropFilter: "blur(0px)" }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            onAnimationComplete={() => setTransitionPhase(null)}
          />
        )}
      </AnimatePresence>
    </>
  );
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  let message = "Oops!";
  let details = "An unexpected error occurred.";
  let stack: string | undefined;

  if (isRouteErrorResponse(error)) {
    message = error.status === 404 ? "404" : "Error";
    details =
      error.status === 404
        ? "The requested page could not be found."
        : error.statusText || details;
  } else if (import.meta.env.DEV && error && error instanceof Error) {
    details = error.message;
    stack = error.stack;
  }

  return (
    <main className="pt-16 p-4 container mx-auto">
      <h1>{message}</h1>
      <p>{details}</p>
      {stack && (
        <pre className="w-full p-4 overflow-x-auto">
          <code>{stack}</code>
        </pre>
      )}
    </main>
  );
}
