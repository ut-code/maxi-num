import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
    index("routes/home.tsx"),
    route("stages", "routes/stages.tsx"),
    route("play/:id?", "routes/playstage.tsx"),
    route("api/ranking", "routes/api.ranking.ts"),
] satisfies RouteConfig;
