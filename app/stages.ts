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
    startNums: [12, 18],
    fixedCards: [
      {
        card: { type: "minus", value: 20 },
        row: 1,
        lane: 0,
      },
      {
        card: { type: "divide", value: 5 },
        row: 3,
        lane: 1,
      },
    ],
    cards: [
      { type: "gcdLcm" },
      { type: "ratio" },
      { type: "multiply", value: 2 },
      { type: "plus", value: 4 },
      { type: "backwards" },
      { type: "minus", value: 1 },
      { type: "backwards" },
      { type: "plus", value: 3 },
      { type: "multiply", value: 5 }
    ],
  },
  {
    startNums: [18, 42, 60],
    fixedCards: [
      {
        card: { type: "minus", value: 20 },
        row: 1,
        lane: 0,
      },
      {
        card: { type: "divisorCount" },
        row: 1,
        lane: 1,
      },
        {
        card: { type: "divide", value: 7 },
        row: 1,
        lane: 2,
      },
    ],
    cards: [
      { type: "ratio3" },
      { type: "sortAsc" },
      { type: "divisorCount" },
      { type: "multiply", value: 6 },
      { type: "multiply", value: 3 },
      { type: "plus", value: 7 },
      { type: "mod", value: 9 },
      { type: "ratio3" },
      { type: "divisorCount" },
      { type: "backwards" }
    ],
  },
  {
    startNums: [86],
    cards: [
      { type: "plus", value: 1 },
      { type: "minus", value: 2 },
      { type: "multiply", value: 2 },
      { type: "backwards" },
      { type: "backwards" },
    ]
  },
  {
    startNums: [5, 28, 78],
    cards: [
      { type: "plus", value: 2 },
      { type: "multiply", value: 5 },
      { type: "minus", value: 3 },
      { type: "backwards" },
      { type: "gcdLcm" },
      { type: "gcdLcm" },
    ] ,
    fixedCards: [
      {
        card: { type: "ratio3" },
        row: 1,
        lane: 0,
      },
      {
        card: { type: "ratio3" },
        row: 3,
        lane: 0,
      },
    ]
  },  {
    startNums: [6],
    cards: [
      { type: "plus", value: 1 },
      { type: "minus", value: 1 },
      { type: "multiply", value: 2 },
      { type: "divide", value: 2 },
    ],
  },
  {
    startNums: [11111, 11],
    cards: [
      { type: "divmod" },
      { type: "divmod" },
      { type: "multiply", value: 10 },
      { type: "multiply", value: 10 },
      { type: "backwards" },
      { type: "backwards" },
    ],
  },
];
