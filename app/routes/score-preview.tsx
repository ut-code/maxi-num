import { useState } from "react";
import { ScorePopup } from "~/components/ScorePopup";
import { calculateResult } from "~/game";
import { arrangements } from "~/score";
import { STAGES, type Card } from "~/stages";
import type { Route } from "./+types/score-preview";

// スコア画面の見た目確認用。ゲーム画面ができたら削除する

export function meta({}: Route.MetaArgs) {
  return [{ title: "スコア画面プレビュー" }];
}

const STAGE_NUMBER = 1;
const STAGE = STAGES[STAGE_NUMBER - 1];
// カードを一部だけ使う並べ方も含めて切り替えられるようにする
const ORDERS = arrangements(STAGE.cards);

function cardLabel(card: Card) {
  switch (card.type) {
    case "plus":
      return `+${card.value}`;
    case "minus":
      return `−${card.value}`;
    case "multiply":
      return `×${card.value}`;
    case "divide":
      return `÷${card.value}`;
    case "mod":
      return `mod ${card.value}`;
    case "backwards":
      return "反転";
    case "divisorCount":
      return "約数の個数";
  }
}

export default function ScorePreview() {
  const [orderIndex, setOrderIndex] = useState(0);
  const [showScore, setShowScore] = useState(false);
  const order = ORDERS[orderIndex];
  const result = calculateResult(STAGE.startNum, order);
  const usedAllCards = order.length === STAGE.cards.length;

  return (
    <main className="relative w-screen h-screen overflow-hidden bg-[#f7f5f0] font-serif text-[#55524e]">
      {/* 仮のゲーム画面 */}
      <div className="flex justify-center gap-[200px] pt-[160px]">
        <div className="flex flex-col gap-[30px]">
          <p className="text-4xl">{STAGE.startNum} ↓</p>
          {order.map((card, i) => (
            <div
              key={i}
              className="flex items-center justify-center w-[220px] h-[56px] bg-[#d9d9d9] border border-[#555] text-2xl"
            >
              {cardLabel(card)}
            </div>
          ))}
          <p className="text-4xl text-right">→ {result}</p>
        </div>
        <div className="flex flex-col gap-6 self-end">
          <button
            type="button"
            onClick={() => setOrderIndex((orderIndex + 1) % ORDERS.length)}
            className="w-[280px] h-[60px] rounded-lg bg-[#d9d9d9] hover:bg-[#cfcfcf] text-xl"
          >
            並べ替える
          </button>
          <button
            type="button"
            onClick={() => setShowScore(true)}
            className="w-[280px] h-[90px] rounded-lg bg-[#efbc62] hover:bg-[#e9ad45] text-4xl text-[#6b5832] tracking-[0.2em] shadow-[0_4px_8px_rgba(0,0,0,0.25)]"
          >
            実行
          </button>
        </div>
      </div>

      {showScore && (
        <ScorePopup
          stageNumber={STAGE_NUMBER}
          result={result}
          usedAllCards={usedAllCards}
          onClose={() => setShowScore(false)}
        />
      )}
    </main>
  );
}
