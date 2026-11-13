import { createRequestHandler, RouterContextProvider } from "react-router";

type Env = {
  SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
};

type WorkerExecutionContext = {
  waitUntil(promise: Promise<unknown>): void;
  passThroughOnException(): void;
};

declare module "react-router" {
  interface AppLoadContext {
    cloudflare: {
      env: Env;
      ctx: WorkerExecutionContext;
    };
  }
}

const requestHandler = createRequestHandler(
  () => import("virtual:react-router/server-build"),
  import.meta.env.MODE
);

export default {
  fetch(request: Request, env: Env, ctx: WorkerExecutionContext) {
    const loadContext = new RouterContextProvider() as RouterContextProvider & {
      cloudflare: { env: Env; ctx: WorkerExecutionContext };
    };
    loadContext.cloudflare = { env, ctx };
    return requestHandler(request, loadContext);
  },
};
