import { useEffect, useId, useMemo, useRef } from "react";
import { Link, useFetcher } from "react-router";
import type { action, loader } from "~/routes/api.ranking";
import { calculateStars } from "~/score";
import { STAGES } from "~/stages";

export type ScorePopupProps = {
  stageNumber: number;
  // プレイヤーが並べた順にすべての演算をした結果
  result: number;
  // 手札のカードをすべて使ったか。使っていなければ星0になる
  usedAllCards: boolean;
  // ×ボタン（またはEsc）で呼ばれる。ゲーム画面側でポップアップを消して、プレイした盤面を見られるようにする
  onClose: () => void;
};

const MAX_STARS = 3;
const NAME_MAX_LENGTH = 20;

const STAR_PATH =
  "M12 1.5 L15.1 8.3 L22.5 9.1 L17 14.1 L18.5 21.4 L12 17.7 L5.5 21.4 L7 14.1 L1.5 9.1 L8.9 8.3 Z";

function Star({ fill, size }: { fill: number; size: number }) {
  const clipId = useId();
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <clipPath id={clipId}>
        <rect width={24 * fill} height="24" />
      </clipPath>
      <path d={STAR_PATH} fill="#e4e4e4" />
      <path d={STAR_PATH} fill="#f0b847" clipPath={`url(#${clipId})`} />
    </svg>
  );
}

function Stars({ count, size }: { count: number; size: number }) {
  return (
    <div className="flex gap-[0.4em]" aria-label={`星${count}つ`}>
      {[...Array(MAX_STARS).keys()].map((i) => (
        <Star key={i} fill={Math.min(Math.max(count - i, 0), 1)} size={size} />
      ))}
    </div>
  );
}

export function ScorePopup({ stageNumber, result, usedAllCards, onClose }: ScorePopupProps) {
  // 全パターンを計算するので、送信中などの再描画のたびに計算し直さないようにする
  const stars = useMemo(
    () => calculateStars(STAGES[stageNumber - 1], result, usedAllCards),
    [stageNumber, result, usedAllCards]
  );
  const hasNextStage = stageNumber < STAGES.length;

  const rankingFetcher = useFetcher<typeof loader>();
  const submitFetcher = useFetcher<typeof action>();
  const submitError = submitFetcher.data?.error;
  const submitted = submitFetcher.data !== undefined && !submitError;
  const sending = submitFetcher.state !== "idle";
  // 送信したあとは、自分のスコアの前後のランキングを表示する
  const ranking = submitted ? submitFetcher.data : rankingFetcher.data;

  const listRef = useRef<HTMLOListElement>(null);
  const myEntryRef = useRef<HTMLLIElement>(null);
  const myEntryId = ranking?.error === undefined ? ranking?.myEntryId : null;

  useEffect(() => {
    rankingFetcher.load(`/api/ranking?stage=${stageNumber}`);
  }, [stageNumber]);

  // 送信したら、ランキングを自分の行が真ん中に来るまでスクロールする
  useEffect(() => {
    const list = listRef.current;
    const myEntry = myEntryRef.current;
    if (!list || !myEntry) return;
    list.scrollTop = myEntry.offsetTop - (list.clientHeight - myEntry.clientHeight) / 2;
  }, [myEntryId]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="スコア"
      className="fixed inset-0 z-50 overflow-auto bg-[#5f5f5f]/50 font-serif text-[#55524e] select-none"
    >
      <div className="flex min-h-full items-center justify-center gap-[30px] p-8">
        {/* スコア表示 */}
        <section className="relative mt-[140px]">
          <button
            type="button"
            onClick={onClose}
            aria-label="閉じる"
            className="absolute -top-[50px] right-[7px] flex items-center justify-center w-[33px] h-[33px] bg-[#d9d9d9] hover:bg-[#cfcfcf] text-white text-2xl leading-none"
          >
            ×
          </button>

          <div className="flex flex-col items-center w-[516px] h-[393px] pt-[60px] bg-[#5f5f5f] shadow-[0_6px_16px_rgba(0,0,0,0.3)]">
            <h1 className="text-3xl font-normal text-[#e6e6e6] tracking-[0.15em]">
              あなたのスコア：
            </h1>
            <div className="mt-6">
              <Stars count={stars} size={76} />
            </div>

            <submitFetcher.Form
              method="post"
              action="/api/ranking"
              className="relative flex items-center w-[425px] h-[60px] mt-4 px-5 rounded-md bg-[#d9d9d9]"
            >
              <input type="hidden" name="stage" value={stageNumber} />
              <input type="hidden" name="result" value={result} />
              <input type="hidden" name="usedAllCards" value={String(usedAllCards)} />
              <label className="flex flex-col">
                <span className="absolute top-1 left-5 text-[10px] text-[#6b6b6b]">
                  名前
                </span>
                <input
                  type="text"
                  name="name"
                  placeholder="名無し"
                  maxLength={NAME_MAX_LENGTH}
                  disabled={submitted}
                  className="w-[150px] h-[34px] mt-3 px-3 rounded bg-white border border-[#555] text-sm text-[#55524e] outline-none focus:border-[#8b5cf6] disabled:bg-[#eeeeee]"
                />
              </label>
              <button
                type="submit"
                disabled={sending || submitted}
                className="flex-1 text-center text-base text-[#6b6b6b] tracking-wider hover:text-[#3f3f3f] disabled:hover:text-[#6b6b6b]"
              >
                {sending ? "送信中…" : submitted ? "送信しました" : "スコアを送信→"}
              </button>
              {submitError && (
                <p className="absolute -bottom-5 left-5 text-xs text-[#ffc9c9]">
                  {submitError}
                </p>
              )}
            </submitFetcher.Form>

            <div className="flex gap-[20px] mt-4">
              <Link
                to="/stages"
                className="flex items-center justify-center w-[202px] h-[60px] rounded-lg bg-[#d9d9d9] hover:bg-[#cfcfcf] text-sm text-[#6b6b6b] tracking-wider shadow-[0_3px_6px_rgba(0,0,0,0.25)]"
              >
                ステージ選択へ
              </Link>
              {hasNextStage ? (
                <Link
                  to={`/play/${stageNumber + 1}`}
                  className="flex items-center justify-center w-[202px] h-[60px] rounded-lg bg-[#efbc62] hover:bg-[#e9ad45] text-sm text-[#6b5832] tracking-wider shadow-[0_3px_6px_rgba(0,0,0,0.25)]"
                >
                  次のステージへ
                </Link>
              ) : (
                <span className="flex items-center justify-center w-[202px] h-[60px] rounded-lg bg-[#efbc62] opacity-50 text-sm text-[#6b5832] tracking-wider">
                  次のステージへ
                </span>
              )}
            </div>
          </div>
        </section>

        {/* ランキング */}
        <section className="flex flex-col w-[520px] h-[532px] pt-6 pl-[32px] pr-[20px] pb-4 bg-white rounded-2xl shadow-[0_6px_16px_rgba(0,0,0,0.2)]">
          <h2 className="pl-[58px] text-xl font-normal tracking-[0.2em] text-[#1a1a1a]">
            ランキング
          </h2>
          {ranking === undefined ? (
            <p className="mt-6 pl-[58px] text-sm text-[#8a8a8a]">読み込み中…</p>
          ) : ranking.error !== undefined ? (
            <p className="mt-6 pl-[58px] text-sm text-[#c0392b]">{ranking.error}</p>
          ) : ranking.entries.length === 0 ? (
            <p className="mt-6 pl-[58px] text-sm text-[#8a8a8a]">まだスコアがありません</p>
          ) : (
            <ol
              ref={listRef}
              className="relative flex flex-col gap-[10px] mt-6 pr-3 min-h-0 flex-1 overflow-y-auto"
            >
              {ranking.entries.map((entry) => (
                <li
                  key={entry.id}
                  ref={entry.id === ranking.myEntryId ? myEntryRef : undefined}
                  className={`flex shrink-0 items-center h-[54px] px-4 bg-white text-[#1a1a1a] ${
                    entry.id === ranking.myEntryId
                      ? "border-2 border-[#efbc62]"
                      : "border-[3px] border-[#ededed]"
                  }`}
                >
                  <span className="w-[110px] text-base">{entry.rank}位</span>
                  <span className="flex-1 truncate text-base tracking-wider">{entry.name}</span>
                  <Stars count={entry.stars} size={28} />
                </li>
              ))}
            </ol>
          )}
        </section>
      </div>
    </div>
  );
}
