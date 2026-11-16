import {
  applyCard,
  applyUnaryCard,
  calculateAverageScore,
  getCardLaneSpan,
  isUnaryCard,
} from "./game";
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



type CardPlacement = {
  card: Card;
  startLane: number;
  laneSpan: number;
};

type CardRows = CardPlacement[][];

type RowLayout = {
  placements: CardPlacement[];
  remainingCards: Card[];
};

// 固定カードを避けて手札カードを配置し、1行分のレイアウトを列挙する
function* expandCardSteps(
  cards: Card[],
  laneCount: number,
  fixedPlacements: CardPlacement[]
): Generator<RowLayout> {
  const placements = [...fixedPlacements];
  const occupied = Array.from({ length: laneCount }, () => false);

  for (const placement of fixedPlacements) {
    for (
      let lane = placement.startLane;
      lane < placement.startLane + placement.laneSpan;
      lane += 1
    ) {
      occupied[lane] = true;
    }
  }

  function* expand(
    cardIndex: number,
    remainingCards: Card[]
  ): Generator<RowLayout> {
    if (cardIndex >= cards.length) {
      yield { placements: [...placements], remainingCards };
      return;
    }

    const card = cards[cardIndex];
    yield* expand(cardIndex + 1, [...remainingCards, card]);

    const laneSpan = getCardLaneSpan(card, laneCount);
    for (let startLane = 0; startLane <= laneCount - laneSpan; startLane += 1) {
      const lanes = Array.from(
        { length: laneSpan },
        (_, index) => startLane + index
      );
      if (lanes.some((lane) => occupied[lane])) continue;

      lanes.forEach((lane) => {
        occupied[lane] = true;
      });
      placements.push({ card, startLane, laneSpan });
      yield* expand(cardIndex + 1, remainingCards);
      placements.pop();
      lanes.forEach((lane) => {
        occupied[lane] = false;
      });
    }
  }

  yield* expand(0, []);
}

function applyRow(
  current: readonly number[],
  placements: CardPlacement[]
): number[] | undefined {
  const next = [...current];

  for (const placement of placements) {
    if (placement.laneSpan === 1) continue;
    const inputs = current.slice(
      placement.startLane,
      placement.startLane + placement.laneSpan
    );
    const result = applyCard(inputs, placement.card);
    if (!result.success) return undefined;
    result.value.forEach((value, index) => {
      next[placement.startLane + index] = value;
    });
  }

  for (const placement of placements) {
    if (placement.laneSpan !== 1 || !isUnaryCard(placement.card)) continue;
    const result = applyUnaryCard(current[placement.startLane], placement.card);
    if (!result.success) return undefined;
    next[placement.startLane] = result.value;
  }

  return next;
}

// 固定カードの配置を保ったまま手札カードを配置して実行結果をシミュレート
function resultsWithFixedCards(stage: Stage, maximizeCards: boolean): number[] {
  const laneCount = stage.startNums.length;
  const fixedCards = stage.fixedCards ?? [];
  const fixedRows: CardRows = Array.from({ length: SLOT_COUNT }, () => []);

  for (const fc of fixedCards) {
    if (fc.row < 0 || fc.row >= SLOT_COUNT) continue;
    const laneSpan = getCardLaneSpan(fc.card, laneCount);
    const startLane =
      laneSpan === 1
        ? fc.lane ?? 0
        : Math.min(fc.lane ?? 0, laneCount - laneSpan);
    if (startLane < 0 || startLane + laneSpan > laneCount) continue;

    fixedRows[fc.row].push({ card: fc.card, startLane, laneSpan });
  }

  const maxCardsCache = new Map<string, number>();
  const maxCardsPlaceable = (row: number, remainingCards: Card[]): number => {
    if (row === SLOT_COUNT) return 0;
    const key = JSON.stringify([row, remainingCards]);
    const cached = maxCardsCache.get(key);
    if (cached !== undefined) return cached;

    let maximum = 0;
    for (const layout of expandCardSteps(
      remainingCards,
      laneCount,
      fixedRows[row]
    )) {
      const usedInRow = remainingCards.length - layout.remainingCards.length;
      maximum = Math.max(
        maximum,
        usedInRow + maxCardsPlaceable(row + 1, layout.remainingCards)
      );
    }
    maxCardsCache.set(key, maximum);
    return maximum;
  };

  const cache = new Map<string, Map<number, Set<number>>>();
  const search = (
    row: number,
    current: readonly number[],
    remainingCards: Card[]
  ): Map<number, Set<number>> => {
    if (row === SLOT_COUNT) {
      const average = calculateAverageScore(current);
      return average.success
        ? new Map([[0, new Set([average.value])]])
        : new Map();
    }

    const key = JSON.stringify([row, current, remainingCards]);
    const cached = cache.get(key);
    if (cached) return cached;

    const resultsByCardCount = new Map<number, Set<number>>();
    for (const layout of expandCardSteps(
      remainingCards,
      laneCount,
      fixedRows[row]
    )) {
      const next = applyRow(current, layout.placements);
      if (!next) continue;

      const cardsUsedInRow = remainingCards.length - layout.remainingCards.length;
      for (const [cardsUsedLater, scores] of search(
        row + 1,
        next,
        layout.remainingCards
      )) {
        const totalCardsUsed = cardsUsedInRow + cardsUsedLater;
        const target =
          resultsByCardCount.get(totalCardsUsed) ?? new Set<number>();
        for (const score of scores) target.add(score);
        resultsByCardCount.set(totalCardsUsed, target);
      }
    }

    cache.set(key, resultsByCardCount);
    return resultsByCardCount;
  };

  const allResults = search(0, stage.startNums, stage.cards);
  const results = new Set<number>();
  const maxCardsUsed = maximizeCards
    ? maxCardsPlaceable(0, stage.cards)
    : undefined;
  for (const [cardsUsed, scores] of allResults) {
    if (maximizeCards && cardsUsed !== maxCardsUsed) continue;
    for (const score of scores) results.add(score);
  }
  return [...results].sort((a, b) => b - a);
}

// 可能な限り多くのカードを使ったときに起こりうる計算結果。星の数の基準にする
export function possibleResults(stage: Stage): number[] {
  return resultsWithFixedCards(stage, true);
}

// カードを一部だけ使った場合も含めて、起こりうる計算結果
export function reachableResults(stage: Stage): number[] {
  return resultsWithFixedCards(stage, false);
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
