import { useState, useCallback, useMemo, useRef, useEffect } from "react";
import { useParams } from "react-router";
import { STAGES, type Card, type Stage } from "~/stages";
import { applyCard } from "~/game";
import { StageHeader } from "~/components/StageHeader";
import { OperationTile } from "~/components/OperationTile";
import { ScorePopup } from "~/components/ScorePopup";

export function meta() {
  return [
    { title: "プレイ画面" },
    { name: "description", content: "プレイ画面" },
  ];
}

// ドラッグ元（トレイか、あるいは左のスロットか）
type DragSource =
  | { type: "tray"; originalIndex: number }
  | { type: "slot"; slotIndex: number };

// ドラッグ中の状態
type DragState = {
  card: Card;
  source: DragSource;
  pointerX: number;
  pointerY: number;
  offsetX: number;
  offsetY: number;
  originRect: { left: number; top: number; width: number; height: number };
};

// スロット外で離した時のスナップバック（元の位置に戻る）アニメーション状態
type SnapBackState = {
  card: Card;
  startX: number;
  startY: number;
  targetX: number;
  targetY: number;
  width: number;
  height: number;
  isAnimating: boolean;
};

// 移動する数字トークンの状態
type MovingToken = {
  value: number;
  x: number;
  y: number;
  scale: number;
  opacity: number;
  transition: string;
  isPopping?: boolean;
  isError?: boolean;
};

export default function PlayStage(props?: Partial<Stage>) {
  const params = useParams();
  const routeStageNumber = params.id ? parseInt(params.id, 10) : 1;
  const stageNumber = !Number.isNaN(routeStageNumber) ? routeStageNumber : 1;
  const currentStage = STAGES[stageNumber - 1] ?? STAGES[0];
  // 存在しない番号のときはステージ1を表示しているので、スコアもステージ1として扱う
  const scoreStageNumber = STAGES[stageNumber - 1] ? stageNumber : 1;
  const stage = {
    startNum: props?.startNum ?? currentStage.startNum,
    cards: props?.cards ?? currentStage.cards,
  };

  // スロット数（4スロット）
  const SLOT_COUNT = 4;
  // トレイの最低スロット数（5スロット）
  const MIN_TRAY_COUNT = 5;

  // 左側の配置スロット状態（4スロット）: 各スロットに置かれたカードの元トレイインデックス
  const [placedIndices, setPlacedIndices] = useState<(number | null)[]>([
    null,
    null,
    null,
    null,
  ]);

  // 計算結果の表示数値（初期値は startNum）
  const [outputNum, setOutputNum] = useState<number>(stage.startNum);
  // 実行中状態
  const [isExecuting, setIsExecuting] = useState(false);
  // 現在実行ハイライト中のスロットインデックス
  const [activeStep, setActiveStep] = useState<number | null>(null);
  // エラーメッセージ（0での除算など）
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  // 演算が最後まで終わったときに表示するスコア画面の内容（×で閉じると null）
  // ステージを移っても状態が残るので、どのステージの結果かも持つ
  const [score, setScore] = useState<{
    stageNumber: number;
    result: number;
    usedAllCards: boolean;
  } | null>(null);

  // 移動する数字トークンのアニメーション状態
  const [movingToken, setMovingToken] = useState<MovingToken | null>(null);

  // ドラッグ＆ドロップ状態
  const [dragState, setDragState] = useState<DragState | null>(null);
  const [hoveredSlotIndex, setHoveredSlotIndex] = useState<number | null>(null);
  const [snapBack, setSnapBack] = useState<SnapBackState | null>(null);

  // 各要素の DOM Ref
  const pipelineContainerRef = useRef<HTMLDivElement | null>(null);
  const startNumRef = useRef<HTMLSpanElement | null>(null);
  const outputNumRef = useRef<HTMLSpanElement | null>(null);
  const slotRefs = useRef<(HTMLDivElement | null)[]>([]);
  const trayItemRefs = useRef<(HTMLDivElement | null)[]>([]);

  // ドラッグ開始時のポインタ座標（微小移動をクリックとして扱うための閾値判定用）
  const dragStartPosRef = useRef<{ x: number; y: number } | null>(null);
  const dragStartTimeRef = useRef<number>(0);
  const hasMovedRef = useRef<boolean>(false);

  // ステージのカードリスト
  const stageCards = stage.cards;

  // トレイ用のカードリスト
  const traySlots = useMemo(() => {
    const count = Math.max(MIN_TRAY_COUNT, stageCards.length);
    const slots = [];
    for (let i = 0; i < count; i++) {
      if (i < stageCards.length) {
        slots.push({
          card: stageCards[i],
          originalIndex: i,
        });
      } else {
        slots.push(null);
      }
    }
    return slots;
  }, [stageCards]);

  // ----------------------------------------------------
  // ドラッグ＆ドロップ（ホールドして運ぶ）ロジック
  // ----------------------------------------------------

  // スロットとの当たり判定
  const getHitSlot = useCallback((x: number, y: number): number | null => {
    for (let i = 0; i < SLOT_COUNT; i++) {
      const slotEl = slotRefs.current[i];
      if (!slotEl) continue;
      const rect = slotEl.getBoundingClientRect();
      // 指やマウスが合わせやすいよう少し広めの判定領域
      if (
        x >= rect.left - 15 &&
        x <= rect.right + 15 &&
        y >= rect.top - 15 &&
        y <= rect.bottom + 15
      ) {
        return i;
      }
    }
    return null;
  }, []);

  // ホールド開始（トレイのカード または スロットのカード）
  const handlePointerDown = useCallback(
    (
      e: React.PointerEvent<HTMLElement>,
      source: DragSource,
      card: Card
    ) => {
      if (isExecuting) return;
      if (e.button !== 0) return; // 主ボタン（左クリック/タッチ）のみ

      e.preventDefault(); // テキスト選択などを防止
      const rect = e.currentTarget.getBoundingClientRect();

      dragStartPosRef.current = { x: e.clientX, y: e.clientY };
      dragStartTimeRef.current = Date.now();
      hasMovedRef.current = false;

      setDragState({
        card,
        source,
        pointerX: e.clientX,
        pointerY: e.clientY,
        offsetX: e.clientX - rect.left,
        offsetY: e.clientY - rect.top,
        originRect: {
          left: rect.left,
          top: rect.top,
          width: rect.width,
          height: rect.height,
        },
      });
      // 左スロットから掴んだ場合はそのスロット、トレイからの場合は座標で判定
      const initialHit =
        source.type === "slot"
          ? source.slotIndex
          : getHitSlot(e.clientX, e.clientY);
      setHoveredSlotIndex(initialHit);
      setErrorMessage(null);
    },
    [isExecuting, getHitSlot]
  );

  // ドラッグ中のグローバルリスナー（ポインタ移動・ホールド解除）
  useEffect(() => {
    if (!dragState) return;

    const handlePointerMove = (e: PointerEvent) => {
      if (dragStartPosRef.current) {
        const dist = Math.hypot(
          e.clientX - dragStartPosRef.current.x,
          e.clientY - dragStartPosRef.current.y
        );
        if (dist > 5) {
          hasMovedRef.current = true;
        }
      }

      setDragState((prev) =>
        prev
          ? {
              ...prev,
              pointerX: e.clientX,
              pointerY: e.clientY,
            }
          : null
      );

      // 左側の4つのスロットとの当たり判定
      setHoveredSlotIndex(getHitSlot(e.clientX, e.clientY));
    };

    const handlePointerUp = (e: PointerEvent) => {
      const currentDrag = dragState;
      // 離した瞬間の座標で確実に判定（フォールバックとして hoveredSlotIndex）
      const hitSlot = getHitSlot(e.clientX, e.clientY);
      const targetSlot = hitSlot !== null ? hitSlot : hoveredSlotIndex;
      setDragState(null);
      setHoveredSlotIndex(null);

      if (!currentDrag) return;

      // 判定: スロットの上で離したか、スロット外で離したか
      if (targetSlot !== null) {
        // === スロットの上にドロップ ===
        if (currentDrag.source.type === "tray") {
          const origIdx = currentDrag.source.originalIndex;
          setPlacedIndices((prev) => {
            const next = [...prev];
            // もし他のスロットに同じカードがあれば解除
            for (let i = 0; i < next.length; i++) {
              if (next[i] === origIdx) {
                next[i] = null;
              }
            }
            next[targetSlot] = origIdx;
            return next;
          });
        } else {
          // 左スロットから別のスロットへ移動
          const fromSlot = currentDrag.source.slotIndex;
          if (targetSlot !== fromSlot) {
            setPlacedIndices((prev) => {
              const next = [...prev];
              const temp = next[targetSlot];
              next[targetSlot] = next[fromSlot];
              next[fromSlot] = temp;
              return next;
            });
          }
          // targetSlot === fromSlot（同じスロット）の場合は維持（スロットから外さない）
        }
      } else {
        // === スロットがないところでホールドを外した ===
        let targetRect = currentDrag.originRect;

        // 左スロットから持ち出して外で外した場合は、スロットから外して右側トレイの対応スロットへ戻る
        if (currentDrag.source.type === "slot") {
          const fromSlot = currentDrag.source.slotIndex;
          const origIdx = placedIndices[fromSlot];
          setPlacedIndices((prev) => {
            const next = [...prev];
            next[fromSlot] = null;
            return next;
          });
          if (origIdx !== null && trayItemRefs.current[origIdx]) {
            const r = trayItemRefs.current[origIdx]!.getBoundingClientRect();
            targetRect = {
              left: r.left,
              top: r.top,
              width: r.width,
              height: r.height,
            };
          }
        }

        const currentX = currentDrag.pointerX - currentDrag.offsetX;
        const currentY = currentDrag.pointerY - currentDrag.offsetY;

        // スナップバックアニメーションを開始
        setSnapBack({
          card: currentDrag.card,
          startX: currentX,
          startY: currentY,
          targetX: targetRect.left,
          targetY: targetRect.top,
          width: targetRect.width,
          height: targetRect.height,
          isAnimating: false,
        });
      }
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    window.addEventListener("pointercancel", handlePointerUp);

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
      window.removeEventListener("pointercancel", handlePointerUp);
    };
  }, [dragState, hoveredSlotIndex, placedIndices, getHitSlot]);

  // スナップバックアニメーションの駆動（次フレームで target へ transition、完了後消去）
  useEffect(() => {
    if (!snapBack) return;

    if (!snapBack.isAnimating) {
      const frame = requestAnimationFrame(() => {
        setSnapBack((prev) => (prev ? { ...prev, isAnimating: true } : null));
      });
      return () => cancelAnimationFrame(frame);
    }

    const timer = setTimeout(() => {
      setSnapBack(null);
    }, 240);

    return () => clearTimeout(timer);
  }, [snapBack]);

  // 左のスロットをクリックして外す処理（タップでも戻せるようにする補助機能）
  const handleSlotClick = useCallback(
    (slotIndex: number) => {
      if (isExecuting) return;
      // ドラッグ移動した場合や長押し（ホールド）した場合はクリック（タップ）とみなさない
      const holdDuration = Date.now() - dragStartTimeRef.current;
      if (hasMovedRef.current || holdDuration > 250) {
        return;
      }
      setPlacedIndices((prev) => {
        const next = [...prev];
        next[slotIndex] = null;
        return next;
      });
      setErrorMessage(null);
    },
    [isExecuting]
  );

  // ----------------------------------------------------
  // 実行ボタンクリック時：数字が移動しながら計算するアニメーション
  // ----------------------------------------------------
  const handleExecute = useCallback(async () => {
    if (isExecuting) return;

    const containerEl = pipelineContainerRef.current;
    const startEl = startNumRef.current;
    const outEl = outputNumRef.current;
    if (!containerEl || !startEl || !outEl) return;

    setErrorMessage(null);
    setIsExecuting(true);
    setActiveStep(null);

    const containerRect = containerEl.getBoundingClientRect();

    // コンテナ相対の中心座標を計算する関数
    const getCenter = (el: HTMLElement) => {
      const r = el.getBoundingClientRect();
      return {
        x: r.left + r.width / 2 - containerRect.left,
        y: r.top + r.height / 2 - containerRect.top,
      };
    };

    const startCenter = getCenter(startEl);
    const outCenter = getCenter(outEl);

    // スロットの列の中央 X 座標（コンテナ中央 x=96px）
    const centerX = containerRect.width / 2;

    // 矢印の折れ曲がり点
    const topCorner = { x: centerX, y: startCenter.y };
    const bottomCorner = { x: centerX, y: outCenter.y };

    let currentVal = stage.startNum;
    setOutputNum(currentVal);

    // 1. 開始数字の位置にトークンを配置
    setMovingToken({
      value: currentVal,
      x: startCenter.x,
      y: startCenter.y,
      scale: 1,
      opacity: 1,
      transition: "none",
    });

    await new Promise((r) => setTimeout(r, 80));

    // 2. 上部矢印に沿って右の折れ曲がり点へ移動
    setMovingToken((prev) =>
      prev
        ? {
            ...prev,
            x: topCorner.x,
            y: topCorner.y,
            transition: "left 200ms cubic-bezier(0.2, 0.8, 0.2, 1), top 200ms cubic-bezier(0.2, 0.8, 0.2, 1)",
          }
        : null
    );
    await new Promise((r) => setTimeout(r, 220));

    // 3. 各スロット（0〜3）を順に通過・計算
    let hasError = false;
    for (let i = 0; i < SLOT_COUNT; i++) {
      const slotEl = slotRefs.current[i];
      if (!slotEl) continue;
      const slotCenter = getCenter(slotEl);

      // スロット中央へ下向きに移動
      setMovingToken((prev) =>
        prev
          ? {
              ...prev,
              x: slotCenter.x,
              y: slotCenter.y,
              transition: "left 170ms cubic-bezier(0.2, 0.8, 0.2, 1), top 170ms cubic-bezier(0.2, 0.8, 0.2, 1)",
            }
          : null
      );
      await new Promise((r) => setTimeout(r, 190));

      const cardIndex = placedIndices[i];
      if (cardIndex !== null) {
        // カードがある場合：スロットをハイライトして計算を適用
        setActiveStep(i);
        const card = stageCards[cardIndex];

        let nextVal = currentVal;
        try {
          nextVal = applyCard(currentVal, card);
        } catch (err: unknown) {
          hasError = true;
          const msg =
            err instanceof Error ? err.message : "計算エラーが発生しました";
          setErrorMessage(msg);
          setTimeout(()=>{
            setErrorMessage(null);
          }, 1000)
        }

        if (hasError) {
          // エラー時のトークン演出（赤く変化・エラー表示）
          setMovingToken((prev) =>
            prev
              ? {
                  ...prev,
                  isError: true,
                  scale: 1.25,
                  transition: "transform 180ms ease-in-out",
                }
              : null
          );
          await new Promise((r) => setTimeout(r, 450));
          break;
        }

        currentVal = nextVal;

        // 計算適用時のポップ演出（値が変わり、ポンッと弾む）
        setMovingToken((prev) =>
          prev
            ? {
                ...prev,
                value: currentVal,
                scale: 1.35,
                isPopping: true,
                transition: "transform 140ms cubic-bezier(0.34, 1.56, 0.64, 1)",
              }
            : null
        );
        await new Promise((r) => setTimeout(r, 160));

        setMovingToken((prev) =>
          prev
            ? {
                ...prev,
                scale: 1.0,
                isPopping: false,
                transition: "transform 140ms ease-out",
              }
            : null
        );
        await new Promise((r) => setTimeout(r, 180));

        setActiveStep(null);
      } else {
        // カードがないスロットはそのままスムーズに通過
        await new Promise((r) => setTimeout(r, 80));
      }
    }

    if (!hasError) {
      // 4. 下部矢印の折れ曲がり点へ下向きに移動
      setMovingToken((prev) =>
        prev
          ? {
              ...prev,
              x: bottomCorner.x,
              y: bottomCorner.y,
              transition: "left 160ms cubic-bezier(0.2, 0.8, 0.2, 1), top 160ms cubic-bezier(0.2, 0.8, 0.2, 1)",
            }
          : null
      );
      await new Promise((r) => setTimeout(r, 180));

      // 5. 最終結果数字の位置へ右向きに移動
      setMovingToken((prev) =>
        prev
          ? {
              ...prev,
              x: outCenter.x,
              y: outCenter.y,
              transition: "left 200ms cubic-bezier(0.2, 0.8, 0.2, 1), top 200ms cubic-bezier(0.2, 0.8, 0.2, 1)",
            }
          : null
      );
      await new Promise((r) => setTimeout(r, 220));

      // 6. 到着：最終結果に吸い込まれるように確定
      setOutputNum(currentVal);
      setMovingToken((prev) =>
        prev
          ? {
              ...prev,
              scale: 1.25,
              opacity: 0,
              transition: "transform 200ms ease-out, opacity 200ms ease-out",
            }
          : null
      );
      await new Promise((r) => setTimeout(r, 220));
    }

    setMovingToken(null);
    setActiveStep(null);
    setIsExecuting(false);

    // 演算が最後まで終わったら、スコア画面を表示する
    if (!hasError) {
      setScore({
        stageNumber: scoreStageNumber,
        result: currentVal,
        usedAllCards:
          placedIndices.filter((index) => index !== null).length === stageCards.length,
      });
    }
  }, [isExecuting, stage.startNum, placedIndices, stageCards, scoreStageNumber]);

  return (
    <main
      key={stageNumber}
      className="relative min-h-screen w-full bg-[#faf8f3] overflow-hidden flex flex-col items-center justify-center p-4 select-none touch-none"
    >
      {/* 背景装飾 */}
      <div
        className="absolute top-12 sm:top-16 left-[53%] sm:left-[55%] w-12 sm:w-16 h-12 sm:h-16 bg-[#e8e6df]/75 pointer-events-none"
        aria-hidden="true"
      />
      <div
        className="absolute top-20 left-[33%] sm:left-[35%] w-3.5 h-3.5 bg-[#e8e6df]/75 pointer-events-none"
        aria-hidden="true"
      />
      <div
        className="absolute bottom-16 sm:bottom-20 left-[18%] sm:left-[22%] w-10 sm:w-11 h-10 sm:h-11 bg-[#e8e6df]/75 pointer-events-none"
        aria-hidden="true"
      />
      <div
        className="absolute bottom-8 sm:bottom-12 left-[48%] sm:left-[52%] w-18 sm:w-22 h-18 sm:h-22 bg-[#e8e6df]/75 pointer-events-none"
        aria-hidden="true"
      />

      {/* 左上のヘッダー（戻るボタンとステージ表示） */}
      <div className="absolute top-0 left-0 z-20">
        <StageHeader stageNumber={stageNumber} backTo="/stages" variant="corner" />
      </div>

      {/* エラーメッセージ */}
      {errorMessage && (
        <div className="absolute top-16 z-30 px-4 py-2 bg-red-50 border border-red-200 rounded-lg text-red-600 font-serif text-sm shadow-sm transition-all animate-bounce">
          {errorMessage}
        </div>
      )}

      {/* メインステージエリア */}
      <div className="relative z-10 flex flex-col sm:flex-row items-center justify-center gap-10 sm:gap-16 md:gap-24 pt-16 sm:pt-4">
        {/* 左側カラム: パイプライン（開始数 → 4スロット → 出力数） */}
        <div
          ref={pipelineContainerRef}
          className="relative flex flex-col items-center"
        >
          {/* 上部矢印と開始数字 */}
          <div className="relative w-48 h-10 select-none">
            {/* 開始数字 */}
            <span
              ref={startNumRef}
              className={`absolute -left-12 top-0.5 font-serif text-2xl text-[#2d2d2d] transition-opacity duration-200 ${
                movingToken ? "opacity-35" : "opacity-100"
              }`}
              style={{
                fontFamily:
                  "'Noto Serif JP', 'Hiragino Mincho ProN', 'Yu Mincho', serif",
              }}
            >
              {stage.startNum}
            </span>

            {/* 上部矢印SVG: 開始数字から右に進み、スロット中央(x=96)で折れ曲がり下を向く */}
            <svg
              className="absolute inset-0 w-full h-full overflow-visible pointer-events-none"
              viewBox="0 0 192 40"
            >
              <path
                d="M -16 14 L 96 14 L 96 32"
                fill="none"
                stroke="#2d2d2d"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <polyline
                points="90 26, 96 32, 102 26"
                fill="none"
                stroke="#2d2d2d"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>

          {/* 4つのスロット */}
          <div className="flex flex-col gap-3.5">
            {Array.from({ length: SLOT_COUNT }).map((_, slotIndex) => {
              const cardIndex = placedIndices[slotIndex];
              const card =
                cardIndex !== null ? stageCards[cardIndex] : undefined;
              const isActive = activeStep === slotIndex;
              const isDropTarget = hoveredSlotIndex === slotIndex;

              // このスロットにあるカードが現在ドラッグ中かどうか
              const isSlotDragging =
                dragState?.source.type === "slot" &&
                dragState.source.slotIndex === slotIndex;

              return (
                <div
                  key={slotIndex}
                  ref={(el) => {
                    slotRefs.current[slotIndex] = el;
                  }}
                  className="relative touch-none"
                >
                  <OperationTile
                    card={card}
                    isDropTarget={isDropTarget}
                    isGhost={isSlotDragging}
                    onPointerDown={
                      card && !isExecuting
                        ? (e) =>
                            handlePointerDown(
                              e,
                              { type: "slot", slotIndex },
                              card
                            )
                        : undefined
                    }
                    onClick={
                      card && !isExecuting
                        ? () => handleSlotClick(slotIndex)
                        : undefined
                    }
                    className={`transition-all duration-150 ${
                      isActive
                        ? "ring-2 ring-[#f6ba52] brightness-105 shadow-[0_0_12px_rgba(246,186,82,0.5)]"
                        : ""
                    } ${
                      card && !isExecuting
                        ? "cursor-grab active:cursor-grabbing hover:brightness-95"
                        : ""
                    }`}
                  />
                </div>
              );
            })}
          </div>

          {/* 下部矢印と結果数字 */}
          <div className="relative w-48 h-11 select-none">
            {/* 下部矢印SVG: スロット中央(x=96)から下に進み、右折して右を向く */}
            <svg
              className="absolute inset-0 w-full h-full overflow-visible pointer-events-none"
              viewBox="0 0 192 44"
            >
              <path
                d="M 96 0 L 96 20 L 130 20"
                fill="none"
                stroke="#2d2d2d"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <polyline
                points="124 15, 130 20, 124 25"
                fill="none"
                stroke="#2d2d2d"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>

            {/* 出力結果数字 */}
            <span
              ref={outputNumRef}
              className={`absolute left-[144px] top-1.5 font-serif text-2xl text-[#2d2d2d] transition-transform duration-200 ${
                !isExecuting ? "scale-100" : ""
              }`}
              style={{
                fontFamily:
                  "'Noto Serif JP', 'Hiragino Mincho ProN', 'Yu Mincho', serif",
              }}
            >
              {outputNum}
            </span>
          </div>

          {/* 移動する数字トークン（実行時に経路を移動し、値が変化する） */}
          {movingToken && (
            <div
              style={{
                position: "absolute",
                left: `${movingToken.x}px`,
                top: `${movingToken.y}px`,
                transform: `translate(-50%, -50%) scale(${movingToken.scale})`,
                transition: movingToken.transition,
                opacity: movingToken.opacity,
              }}
              className={`z-30 pointer-events-none flex items-center justify-center min-w-10 h-10 px-2 rounded-full font-serif font-bold text-xl shadow-[0_4px_16px_rgba(0,0,0,0.2)] ${
                movingToken.isError
                  ? "bg-red-50 border-2 border-red-500 text-red-600 ring-4 ring-red-200"
                  : movingToken.isPopping
                  ? "bg-[#fff8e6] border-2 border-[#f6ba52] text-[#2d2d2d] ring-4 ring-[#f6ba52]/40 shadow-[0_0_20px_rgba(246,186,82,0.8)]"
                  : "bg-[#fdfcf9] border-2 border-[#f6ba52] text-[#2d2d2d]"
              }`}
            >
              {movingToken.value}
            </div>
          )}
        </div>

        {/* 右側カラム: トレイ（白いカードコンテナ） & 実行ボタン */}
        <div className="flex flex-col items-center">
          {/* 白いカードコンテナ */}
          <div className="bg-[#fdfcf9] rounded-2xl p-5 sm:p-6 shadow-[0_4px_24px_rgba(0,0,0,0.06)] border border-black/[0.03]">
            <div className="flex flex-col gap-3.5">
              {traySlots.map((item, index) => {
                if (!item) {
                  // 空タイル
                  return (
                    <div key={`empty-${index}`}>
                      <OperationTile />
                    </div>
                  );
                }

                const isPlaced = placedIndices.includes(item.originalIndex);
                const isTrayDragging =
                  dragState?.source.type === "tray" &&
                  dragState.source.originalIndex === item.originalIndex;

                return (
                  <div
                    key={`tray-${item.originalIndex}`}
                    ref={(el) => {
                      trayItemRefs.current[item.originalIndex] = el;
                    }}
                    className="relative touch-none"
                  >
                    <OperationTile
                      card={item.card}
                      disabled={isPlaced}
                      isGhost={isTrayDragging || isPlaced}
                      onPointerDown={
                        !isPlaced && !isExecuting
                          ? (e) =>
                              handlePointerDown(
                                e,
                                {
                                  type: "tray",
                                  originalIndex: item.originalIndex,
                                },
                                item.card
                              )
                          : undefined
                      }
                      className={
                        isPlaced
                          ? "opacity-30 cursor-not-allowed"
                          : "cursor-grab active:cursor-grabbing hover:brightness-95"
                      }
                    />
                  </div>
                );
              })}
            </div>
          </div>

          {/* 実行ボタン */}
          <button
            type="button"
            onClick={handleExecute}
            disabled={isExecuting}
            className="mt-6 w-48 sm:w-52 h-[46px] rounded-xl bg-[#f6ba52] hover:bg-[#efa93c] active:bg-[#e49c2c] active:scale-[0.98] shadow-[0_3px_10px_rgba(244,184,85,0.35)] transition-all duration-150 flex items-center justify-center font-serif text-[#6b5832] text-xl tracking-[0.25em] pl-[0.25em] select-none cursor-pointer disabled:opacity-75 disabled:cursor-not-allowed"
            style={{
              fontFamily:
                "'Noto Serif JP', 'Hiragino Mincho ProN', 'Yu Mincho', serif",
            }}
          >
            {isExecuting ? "実行中..." : "実行"}
          </button>
        </div>
      </div>

      {/* ドラッグ中のフローティングカード（ホールドして運ぶ） */}
      {dragState && (
        <div
          style={{
            position: "fixed",
            left: `${dragState.pointerX - dragState.offsetX}px`,
            top: `${dragState.pointerY - dragState.offsetY}px`,
            width: `${dragState.originRect.width}px`,
            height: `${dragState.originRect.height}px`,
            pointerEvents: "none",
            zIndex: 100,
            transform: "scale(1.05) rotate(1.2deg)",
          }}
          className="shadow-[0_16px_32px_rgba(0,0,0,0.22)] ring-2 ring-[#f6ba52]/70 rounded-[6px]"
        >
          <OperationTile card={dragState.card} />
        </div>
      )}

      {/* スロット外で離した時のスナップバック（右側トレイに戻る）アニメーション */}
      {snapBack && (
        <div
          style={{
            position: "fixed",
            left: `${snapBack.isAnimating ? snapBack.targetX : snapBack.startX}px`,
            top: `${snapBack.isAnimating ? snapBack.targetY : snapBack.startY}px`,
            width: `${snapBack.width}px`,
            height: `${snapBack.height}px`,
            pointerEvents: "none",
            zIndex: 90,
            transition: snapBack.isAnimating
              ? "left 240ms cubic-bezier(0.2, 0.8, 0.2, 1), top 240ms cubic-bezier(0.2, 0.8, 0.2, 1), transform 240ms cubic-bezier(0.2, 0.8, 0.2, 1)"
              : "none",
            transform: snapBack.isAnimating ? "scale(1)" : "scale(1.05)",
          }}
          className="shadow-lg rounded-[6px]"
        >
          <OperationTile card={snapBack.card} />
        </div>
      )}

      {/* スコア画面（×で閉じると、プレイした盤面がそのまま見られる） */}
      {score && score.stageNumber === scoreStageNumber && (
        <ScorePopup
          stageNumber={score.stageNumber}
          result={score.result}
          usedAllCards={score.usedAllCards}
          onClose={() => setScore(null)}
        />
      )}
    </main>
  );
}
