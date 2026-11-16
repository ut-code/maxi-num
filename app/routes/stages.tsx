import { STAGES, type Stage } from "~/stages";
import type { Route } from "./+types/stages";
import { SelectButton } from "~/components/SelectButton";

export const STAGE_COUNT = STAGES.length;
export function meta({}: Route.MetaArgs) {
  return [
    { title: "ステージ選択" },
    { name: "description", content: "ステージ選択画面" },
  ];
}

export default function StageSelect() {
  return (
    <main className="min-h-screen w-full bg-[#faf8f3] flex flex-col items-center pt-16 sm:pt-24 pb-16 px-4 sm:px-8">
      <div className="w-full max-w-[640px]">
        <h1 className="text-3xl sm:text-4xl font-serif font-normal text-[#1a1a1a] mb-8 sm:mb-10 pl-0.5 select-none">
          ステージ選択
        </h1>
        <div className="grid grid-cols-6 gap-3 sm:gap-4 md:gap-5 w-full">
          {[...Array(STAGE_COUNT).keys()].map((stageNumber) => (
            <SelectButton key={stageNumber+1} stageNumber={stageNumber+1} />
          ))}
        </div>
      </div>
    </main>
  );
}
