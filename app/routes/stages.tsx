import type { Route } from "./+types/stages";
import { SelectButton } from "~/components/SelectButton";
import { FallingBackground } from "~/components/FallingBackground";
import { BackButton } from "~/components/StageHeader";

export const STAGE_COUNT = 6;
const COLUMNS = 3;
export function meta({}: Route.MetaArgs) {
  return [
    { title: "ステージ選択" },
    { name: "description", content: "ステージ選択画面" },
  ];
}

export default function StageSelect() {
  return (
    <main className="relative min-h-screen w-full overflow-hidden bg-[#f7f5f0] flex flex-col items-center pt-16 sm:pt-24 pb-16 px-4 sm:px-8">
      {/* ホーム画面と同じ背景 */}
      <FallingBackground />

      {/* 左上のホームに戻るボタン */}
      <div className="absolute top-4 left-4 z-20">
        <BackButton
          to="/"
          label="ホームに戻る"
          className="w-12 h-12 sm:w-14 sm:h-14"
          iconClassName="w-7 h-7 sm:w-8 sm:h-8"
        />
      </div>

      <div className="relative z-10 w-full max-w-[500px]">
        <h1 className="text-3xl sm:text-4xl font-serif font-normal text-[#1a1a1a] mb-10 sm:mb-14 text-center select-none">
          ステージ選択
        </h1>
        <div
          className="grid gap-10 sm:gap-x-20 sm:gap-y-16 w-full"
          style={{ gridTemplateColumns: `repeat(${COLUMNS}, minmax(0, 1fr))` }}
        >
          {[...Array(STAGE_COUNT).keys()].map((stageNumber) => (
            <SelectButton key={stageNumber+1} stageNumber={stageNumber+1} />
          ))}
        </div>
      </div>
    </main>
  );
}
