import { data } from "react-router";
import { getSupabase, type SupabaseEnv } from "~/db/supabase.server";
import { calculateStars, possibleResults, reachableResults } from "~/score";
import { STAGES } from "~/stages";
import type { Route } from "./+types/api.ranking";

// ランキングの取得（GET）とスコアの送信（POST）を行うAPI

const NAME_MAX_LENGTH = 20;
const DEFAULT_NAME = "名無し";

export type RankingEntry = {
  id: number;
  rank: number;
  name: string;
  stars: number;
};

export type RankingResponse =
  | { entries: RankingEntry[]; myEntryId: number | null; error?: undefined }
  | { error: string };

type CloudflareLoadContext = Route.LoaderArgs["context"] & {
  cloudflare: { env: SupabaseEnv };
};

function getSupabaseEnv(context: Route.LoaderArgs["context"]) {
  return (context as CloudflareLoadContext).cloudflare.env;
}

function parseStageNumber(value: unknown) {
  const stageNumber = Number(value);
  return Number.isInteger(stageNumber) && STAGES[stageNumber - 1]
    ? stageNumber
    : null;
}

// ステージのランキングを、順位をつけてすべて返す
async function getRanking(
  env: SupabaseEnv,
  stageNumber: number,
  myEntryId: number | null
) {
  const { data: rows, error } = await getSupabase(env).from("scores").select(
    "id,name,result,stars"
  ).eq("stageNumber", stageNumber)
    // 星の数で並べてから、同じ星の中を数値の大きい順に並べる
    .order("stars", { ascending: false })
    .order("result", { ascending: false })
    .order("createdAt", { ascending: true });

  if (error) throw error;

  // 星の数と数値が同じなら同じ順位にする
  let rank = 0;
  const entries = rows.map((row, i) => {
    const prev = rows[i - 1];
    if (i === 0 || row.stars !== prev.stars || row.result !== prev.result) rank = i + 1;
    return { id: row.id, rank, name: row.name, stars: row.stars };
  });

  // 同じ順位の人がいるときは、自分を同じ順位の中の一番上に表示する
  const myIndex = entries.findIndex((entry) => entry.id === myEntryId);
  if (myIndex > 0) {
    const firstIndexOfRank = entries.findIndex((entry) => entry.rank === entries[myIndex].rank);
    const [myEntry] = entries.splice(myIndex, 1);
    entries.splice(firstIndexOfRank, 0, myEntry);
  }

  return { entries, myEntryId };
}

export async function loader({ request, context }: Route.LoaderArgs) {
  const env = getSupabaseEnv(context);
  const url = new URL(request.url);
  const stageNumber = parseStageNumber(url.searchParams.get("stage"));
  if (stageNumber === null) {
    return data<RankingResponse>({ error: "ステージが見つかりません" }, { status: 400 });
  }

  try {
    return data<RankingResponse>(await getRanking(env, stageNumber, null));
  } catch (error) {
    console.error(error);
    return data<RankingResponse>({ error: "ランキングを読み込めませんでした" }, { status: 500 });
  }
}

export async function action({ request, context }: Route.ActionArgs) {
  const env = getSupabaseEnv(context);
  const formData = await request.formData();
  const stageNumber = parseStageNumber(formData.get("stage"));
  const result = Number(formData.get("result"));
  const usedAllCards = formData.get("usedAllCards") === "true";
  const name =
    String(formData.get("name") ?? "").trim().slice(0, NAME_MAX_LENGTH) || DEFAULT_NAME;

  if (stageNumber === null) {
    return data<RankingResponse>({ error: "ステージが見つかりません" }, { status: 400 });
  }
  const stage = STAGES[stageNumber - 1];
  // そのステージで（カードの使い方に応じて）出せない数値は受け付けない
  const results = usedAllCards ? possibleResults(stage) : reachableResults(stage);
  if (!results.includes(result)) {
    return data<RankingResponse>({ error: "スコアが正しくありません" }, { status: 400 });
  }

  try {
    const { data: inserted, error } = await getSupabase(env)
      .from("scores")
      .insert({
        stageNumber,
        name,
        result,
        stars: calculateStars(stage, result, usedAllCards),
      })
      .select("id")
      .single();
    if (error) throw error;
    return data<RankingResponse>(await getRanking(env, stageNumber, inserted.id));
  } catch (error) {
    console.error(error);
    return data<RankingResponse>({ error: "スコアを送信できませんでした" }, { status: 500 });
  }
}
