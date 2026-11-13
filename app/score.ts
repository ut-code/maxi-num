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
// すべてのスロットを埋めていないときの星の数
const UNUSED_SLOTS_STARS = 0;
const SLOT_COUNT = 4;

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

// 1つのカード並びに対して、空きスロット数の範囲でUnaryCardのレーン割り当てを展開する
function expandCardSteps(
  order: Card[],
  laneCount: number,
  availableSlots: number = SLOT_COUNT
): CardStep[][] {
  if (order.length === 0 || availableSlots === 0) return [[]];
  const [first, ...rest] = order;
  const restExpanded = expandCardSteps(rest, laneCount, availableSlots - 1);

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

// 固定カードを考慮して空きスロットに行番号順に手札カードを挿入して実行結果をシミュレート
function resultsWithFixedCards(stage: Stage, orders: Card[][]): number[] {
  const results = new Set<number>();
  const laneCount = stage.startNums.length;
  const fixedCards = stage.fixedCards ?? [];

  // 固定カードがない場合は通常の展開
  if (fixedCards.length === 0) {
    for (const order of orders) {
      const expandedSteps = expandCardSteps(order, laneCount);
      console.log(expandedSteps);
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

  // 固定カードがある場合：スロット行(0〜3)の空いている場所を手札カードで埋めるパターンを試す
  // 各行に固定カードがあるか判定
  const fixedByRow = new Map<number, CardStep[]>();
  for (const fc of fixedCards) {
    const list = fixedByRow.get(fc.row) ?? [];
    list.push({ card: fc.card, targetLane: fc.lane ?? 0 });
    fixedByRow.set(fc.row, list);
  }

  const availableRows = Array.from({ length: SLOT_COUNT }, (_, row) => row).filter(
    (row) => !fixedByRow.has(row)
  );

  // 利用可能な空き行インデックス（0〜3のうち手札カードを配置できる行）
  // 簡略化して、固定カードのステップと手札カードのステップを組み合わせる
  for (const order of orders) {
    const expandedSteps = expandCardSteps(order, laneCount, availableRows.length);
    for (const playerSteps of expandedSteps) {
      // playerSteps と fixedCards を行スロットに配置
      // playerStepsの長さが残りの空き行数以下である場合に配置可能
      const totalSteps: CardStep[] = [];
      let playerStepIdx = 0;
      for (let r = 0; r < SLOT_COUNT; r++) {
        if (fixedByRow.has(r)) {
          totalSteps.push(...fixedByRow.get(r)!);
        } else if (playerStepIdx < playerSteps.length) {
          totalSteps.push(playerSteps[playerStepIdx]);
          playerStepIdx += 1;
        }
      }
      try {
        const res = calculateResult(stage.startNums, totalSteps);
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

// 並べ方ごとの計算結果を、重複を除いて大きい順に並べる関数。
// 0で割るなど計算できない並べ方は除く。
function resultsOf(stage: Stage, orders: Card[][]): number[] {
  return resultsWithFixedCards(stage, orders);
}

// カードをすべて使ったときに起こりうる計算結果。星の数の基準にする
export function possibleResults(stage: Stage): number[] {
  return resultsOf(stage, permutations(stage.cards));
}

// カードを一部だけ使った場合も含めて、起こりうる計算結果
export function reachableResults(stage: Stage): number[] {
  return resultsOf(stage, arrangements(stage.cards));
}

// すべてのスロットを埋めていなければ星0。埋めていれば、計算結果の順位で星の数を決める。
export function calculateStars(stage: Stage, result: number, filledAllSlots: boolean): number {
  if (!filledAllSlots) return UNUSED_SLOTS_STARS;
  const results = possibleResults(stage);
  const rank = results.filter((value) => value > result).length + 1;
  if (rank === 1) return MAX_STARS;

  const ratio = rank / results.length;
  for (const threshold of STAR_THRESHOLDS) {
    if (ratio <= threshold.topRatio) return threshold.stars;
  }
  return MIN_STARS;
}
