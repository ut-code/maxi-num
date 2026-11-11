import { calculateResult, isUnaryCard, type CardStep } from "./game";
import type { Card, Stage } from "./stages";

// 上位何%以内なら何個の星か
const STAR_THRESHOLDS = [
  { topRatio: 0.1, stars: 2.5 },
  { topRatio: 0.25, stars: 2 },
  { topRatio: 0.4, stars: 1.5 },
  { topRatio: 0.7, stars: 1 },
];
const MAX_STARS = 3;
const MIN_STARS = 0.5;
// カードをすべては使っていないときの星の数
const UNUSED_CARDS_STARS = 0;

// カードの並べ方をすべて列挙する関数。
export function permutations<T>(items: readonly T[]): T[][] {
  if (items.length <= 1) return [[...items]];
  return items.flatMap((item, i) =>
    permutations([...items.slice(0, i), ...items.slice(i + 1)]).map((rest) => [
      item,
      ...rest,
    ])
  );
}

// カードを何枚使うかも含めて、並べ方をすべて列挙する関数（1枚も使わない場合も含む）。
export function arrangements<T>(items: readonly T[]): T[][] {
  return [
    [],
    ...items.flatMap((item, i) =>
      arrangements([...items.slice(0, i), ...items.slice(i + 1)]).map((rest) => [
        item,
        ...rest,
      ])
    ),
  ];
}

// 1つのカード並びに対して、UnaryCardのレーン割り当てを展開する
function expandCardSteps(order: Card[], laneCount: number): CardStep[][] {
  if (order.length === 0) return [[]];
  const [first, ...rest] = order;
  const restExpanded = expandCardSteps(rest, laneCount);

  if (isUnaryCard(first) && laneCount > 1) {
    const results: CardStep[][] = [];
    for (let lane = 0; lane < laneCount; lane++) {
      for (const r of restExpanded) {
        results.push([{ card: first, targetLane: lane }, ...r]);
      }
    }
    return results;
  }

  return restExpanded.map((r) => [first, ...r]);
}

// 並べ方ごとの計算結果を、重複を除いて大きい順に並べる関数。
// 0で割るなど計算できない並べ方は除く。
function resultsOf(stage: Stage, orders: Card[][]): number[] {
  const results = new Set<number>();
  const laneCount = stage.startNums.length;
  for (const order of orders) {
    const expandedSteps = expandCardSteps(order, laneCount);
    for (const steps of expandedSteps) {
      try {
        const res = calculateResult(stage.startNums, steps);
        if (res.success) {
          results.add(res.score);
        }
      } catch {
        continue;
      }
    }
  }
  return [...results].sort((a, b) => b - a);
}

// カードをすべて使ったときに起こりうる計算結果。星の数の基準にする
export function possibleResults(stage: Stage): number[] {
  return resultsOf(stage, permutations(stage.cards));
}

// カードを一部だけ使った場合も含めて、起こりうる計算結果
export function reachableResults(stage: Stage): number[] {
  return resultsOf(stage, arrangements(stage.cards));
}

// カードをすべて使っていなければ星0。
// すべて使っていれば、計算結果が起こりうる結果の中で大きい方から何番目かによって星の数を決める。
export function calculateStars(stage: Stage, result: number, usedAllCards: boolean): number {
  if (!usedAllCards) return UNUSED_CARDS_STARS;

  const results = possibleResults(stage);
  const rank = results.filter((value) => value > result).length + 1;

  if (rank === 1) return MAX_STARS;

  const ratio = rank / results.length;
  for (const threshold of STAR_THRESHOLDS) {
    if (ratio <= threshold.topRatio) return threshold.stars;
  }
  return MIN_STARS;
}
