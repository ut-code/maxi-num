import { Link } from "react-router";

export type StageHeaderProps = {
  /**
   * ステージ番号 (例: 1, 2, ...)
   * 指定した場合は「ステージ {stageNumber}」と表示されます。
   */
  stageNumber?: number | string;
  /**
   * タイトル文字列を直接指定する場合
   */
  title?: string;
  /**
   * 戻り先URL (デフォルト: "/stages")
   */
  backTo?: string;
  /**
   * 戻るボタンクリック時の追加ハンドラ (省略可)
   */
  onBack?: () => void;
  /**
   * 追加のスタイルクラス
   */
  className?: string;
  /**
   * ヘッダーの配置スタイル ("corner": 左上の角丸タブ, "full": 横幅全体)
   */
  variant?: "corner" | "full";
};

export type BackButtonProps = {
  to: string;
  // 読み上げ用のラベル
  label?: string;
  onClick?: () => void;
  // ボタンの大きさなど
  className?: string;
  // 矢印の大きさ
  iconClassName?: string;
};

// 左向きの矢印の戻るボタン
export function BackButton({
  to,
  label = "ステージ選択に戻る",
  onClick,
  className = "w-10 h-10",
  iconClassName = "w-5 h-5",
}: BackButtonProps) {
  return (
    <Link
      to={to}
      onClick={onClick}
      aria-label={label}
      className={`z-10 flex items-center justify-center rounded-xl bg-[#eceae5] hover:bg-[#e1ded8] active:bg-[#d6d3cc] shadow-[0_2px_4px_rgba(0,0,0,0.08)] active:scale-95 transition-all duration-150 ${className}`}
    >
      <svg
        className={`text-[#504d49] -translate-x-0.5 ${iconClassName}`}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <polyline points="15 18 9 12 15 6" />
      </svg>
    </Link>
  );
}

export function StageHeader({
  stageNumber,
  title,
  backTo = "/stages",
  onBack,
  className = "",
  variant = "corner",
}: StageHeaderProps) {
  const displayTitle =
    title ?? (stageNumber !== undefined ? `ステージ ${stageNumber}` : "ステージ 1");

  if (variant === "corner") {
    return (
      <header
        className={`inline-flex items-center gap-5 bg-white rounded-br-3xl shadow-[0_2px_8px_rgba(0,0,0,0.06)] px-5 py-3 select-none ${className}`}
      >
        {/* 左の戻るボタン */}
        <BackButton
          to={backTo}
          onClick={onBack}
          className="w-12 h-12 sm:w-14 sm:h-14"
          iconClassName="w-7 h-7 sm:w-8 sm:h-8"
        />

        {/* ステージ名表示 */}
        <h1
          className="text-xl sm:text-2xl font-serif text-[#aba8a1] tracking-wider pr-3 font-normal"
          style={{ fontFamily: "'Noto Serif JP', 'Hiragino Mincho ProN', 'Yu Mincho', serif" }}
        >
          {displayTitle}
        </h1>
      </header>
    );
  }

  return (
    <header
      className={`relative w-full h-16 bg-white rounded-b-2xl shadow-[0_2px_8px_rgba(0,0,0,0.06)] flex items-center px-4 select-none ${className}`}
    >
      {/* 左の戻るボタン（ステージ選択画面に戻る） */}
      <BackButton to={backTo} onClick={onBack} className="w-11 h-11" />

      {/* 中央のステージ名表示 */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <h1
          className="text-lg sm:text-xl font-serif text-[#aba8a1] tracking-wider"
          style={{ fontFamily: "'Noto Serif JP', 'Hiragino Mincho ProN', 'Yu Mincho', serif" }}
        >
          {displayTitle}
        </h1>
      </div>
    </header>
  );
}
