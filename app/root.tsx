import {
  isRouteErrorResponse,
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  useLocation,
  useNavigate,
  Route as ReactRouterRoute,
} from "react-router";
import SlideRoutes from "react-slide-routes";
import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";

import type { Route } from "./+types/root";
import { FallingBackground } from "~/components/FallingBackground";
import Home from "./routes/home";
import StageSelect from "./routes/stages";
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
  const location = useLocation();
  const navigate = useNavigate();
  const playLayerRef = useRef<HTMLDivElement>(null);
  const [playDirection, setPlayDirection] = useState<1 | -1>(1);
  const [playSlideEntered, setPlaySlideEntered] = useState(false);
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
        transition: "blur" | "slide";
        slideDirection?: 1 | -1;
      };
      if (detail.transition === "slide") {
        const isPlayTransition =
          /^\/play\/\d+\/?$/.test(location.pathname) &&
          /^\/play\/\d+\/?$/.test(detail.to);
        if (isPlayTransition) {
          setPlayDirection(detail.slideDirection ?? 1);
          setPlaySlideEntered(true);
          const snapshot = playLayerRef.current?.cloneNode(
            true
          ) as HTMLDivElement | null;
          if (snapshot) {
            snapshot.removeAttribute("style");
            snapshot.style.position = "fixed";
            snapshot.style.inset = "0";
            snapshot.style.zIndex = "120";
            snapshot.style.pointerEvents = "none";
            snapshot.style.width = "100vw";
            snapshot.style.height = "100vh";
            document.body.appendChild(snapshot);
            snapshot
              .animate(
                [
                  { transform: "translateX(0%)" },
                  {
                    transform: `translateX(${detail.slideDirection === 1 ? "-100%" : "100%"})`,
                  },
                ],
                {
                  duration: 750,
                  easing: "ease-in-out",
                  fill: "forwards",
                }
              )
              .finished.finally(() => snapshot.remove());
          }
        }
        navigate(detail.to, { replace: detail.replace });
        return;
      }

      setPlaySlideEntered(false);
      pendingNavigation.current = detail;
      setTransitionPhase("blur");
    };

    window.addEventListener("page-transition:navigate", handleNavigation);
    return () =>
      window.removeEventListener("page-transition:navigate", handleNavigation);
  }, [location.pathname, navigate]);

  const isHomeOrSelectStage =
    location.pathname === "/" || location.pathname === "/stages";
  const isPlayPage = /^\/play\/\d+\/?$/.test(location.pathname);

  return (
    <>
      {(isHomeOrSelectStage || isPlayPage) && (
        <div className="fixed inset-0 z-0">
          <FallingBackground showNumbers={!isPlayPage} />
        </div>
      )}
      {isHomeOrSelectStage ? (
        <div className="relative z-10">
          <SlideRoutes
            animation="vertical-slide"
            duration={750}
            timing="ease-in-out"
            destroy
          >
            <ReactRouterRoute path="/*" element={<Home />} />
            <ReactRouterRoute path="/stages" element={<StageSelect />} />
          </SlideRoutes>
        </div>
      ) : (
        <motion.div
          ref={playLayerRef}
          key={location.key}
          initial={
            isPlayPage && playSlideEntered
              ? { x: `${playDirection * 100}%` }
              : false
          }
          animate={{ x: 0 }}
          transition={{ duration: 0.75, ease: "easeInOut" }}
          className={isPlayPage ? "fixed inset-0 z-10" : "relative z-10"}
        >
          <Outlet />
        </motion.div>
      )}
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
