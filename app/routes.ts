import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
    index("routes/home.tsx"),
    route("stages", "routes/stages.tsx"),
    route("score-preview", "routes/score-preview.tsx"),
    route("api/ranking", "routes/api.ranking.ts"),
] satisfies RouteConfig;
