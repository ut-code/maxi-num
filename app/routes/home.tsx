import { Link } from "react-router";
import { FallingBackground } from "~/components/FallingBackground";
import type { Route } from "./+types/home";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "タイトル画面" },
    { name: "description", content: "ゲームのタイトル画面" },
  ];
}

export default function Home() {
  return (
    <div className="relative w-screen h-screen overflow-hidden bg-[#f7f5f0] flex flex-col items-center justify-center select-none">
      <FallingBackground />

      {/* メインコンテンツ */}
      <div className="relative z-10 flex flex-col items-center justify-center -translate-y-4">
        {/* タイトル（明朝体） */}
        <h1
          className="text-5xl md:text-7xl font-normal tracking-[0.25em] text-[#55524e] font-serif mb-24 pl-[0.25em]"
          style={{ fontFamily: "'Noto Serif JP', 'Hiragino Mincho ProN', 'Yu Mincho', serif" }}
        >
          題名
        </h1>

        {/* 開始ボタン */}
        <Link
          to="/stages"
          className="group relative inline-flex items-center justify-center w-64 md:w-72 py-4 rounded-xl text-xl md:text-2xl font-serif text-[#6b5832] bg-[#f4b855] hover:bg-[#efa93c] active:bg-[#e49c2c] shadow-[0_6px_14px_rgba(224,157,48,0.35)] hover:shadow-[0_8px_18px_rgba(224,157,48,0.45)] transition-all duration-200 ease-out active:translate-y-0.5"
          style={{ fontFamily: "'Noto Serif JP', 'Hiragino Mincho ProN', 'Yu Mincho', serif" }}
        >
          <span className="tracking-[0.35em] pl-[0.35em]">開始</span>
        </Link>
      </div>
    </div>
  );
}
