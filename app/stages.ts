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

export type Stage = {
  startNums: StartNumbers;
  cards: Card[];
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
];
