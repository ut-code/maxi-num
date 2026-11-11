// 1入力1出力のカード
export type UnaryCard =
  | { type: "plus"; value: number }
  | { type: "minus"; value: number }
  | { type: "multiply"; value: number }
  | { type: "divide"; value: number }
  | { type: "mod"; value: number }
  | { type: "backwards" }
  | { type: "divisorCount" };

// 2入力2出力のカード
export type BinaryCard =
  | { type: "divmod" }
  | { type: "gcdLcm" }
  | { type: "ratio" }
  | { type: "sortAsc" };

// 3入力3出力のカード
export type TernaryCard =
  | { type: "ratio3" }
  | { type: "sortAsc" };

export type Card = UnaryCard | BinaryCard | TernaryCard;

// 最大3つの初期値 (1〜3個の数値)
export type StartNumbers =
  | [number]
  | [number, number]
  | [number, number, number];

export type FixedCard = {
  card: Card;
  row: number; // 0〜3（SLOT_COUNT-1）
  lane?: number; // UnaryCardの場合はレーン番号（0〜laneCount-1）。省略時は0。ワイドカードの場合はstartLane
};

export type Stage = {
  startNums: StartNumbers;
  cards: Card[];
  fixedCards?: FixedCard[];
};

export const STAGES: Stage[] = [
  {
    startNums: [6],
    cards: [
      { type: "plus", value: 1 },
      { type: "minus", value: 1 },
      { type: "backwards" },
    ],
  },
  {
    startNums: [15, 18],
    cards: [
      { type: "ratio" },
      { type: "plus", value: 2 },
    ],
  },
  {
    startNums: [10, 20, 5],
    cards: [
      { type: "sortAsc" },
      { type: "plus", value: 1 },
    ],
  },
  {
    // 固定カードのあるステージの例
    startNums: [8, 12],
    fixedCards: [
      {
        card: { type: "multiply", value: 2 },
        row: 1,
        lane: 0,
      },
      {
        card: { type: "plus", value: 5 },
        row: 2,
        lane: 1,
      },
    ],
    cards: [
      { type: "ratio" },
      { type: "plus", value: 3 },
      { type: "minus", value: 1 },
    ],
  },
];
