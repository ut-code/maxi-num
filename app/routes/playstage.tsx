import { useState, useCallback, useMemo, useRef, useEffect } from "react";
import { useParams } from "react-router";
import { STAGES, type Card, type Stage, type FixedCard } from "~/stages";
import {
  applyCard,
  applyUnaryCard,
  calculateAverageScore,
  isUnaryCard,
} from "~/game";
import { StageHeader } from "~/components/StageHeader";
import { OperationTile } from "~/components/OperationTile";
import { ScorePopup } from "~/components/ScorePopup";

export function meta() {
  return [
    { title: "プレイ画面" },
    { name: "description", content: "プレイ画面" },
  ];
}

// 数値表示用フォーマッタ（小数は最大2桁）
function formatDisplayNumber(num: number): string {
  if (Number.isInteger(num)) return num.toString();
  const rounded = Math.round(num * 100) / 100;
  return rounded.toString();
}

function getCardLaneSpan(card: Card, laneCount: number): number {
  const span =
    card.type === "ratio3" || (card.type === "sortAsc" && laneCount >= 3)
      ? 3
      : isUnaryCard(card)
        ? 1
        : 2;
  return Math.min(span, laneCount);
}

type WideCardPlacement = {
  originalIndex: number;
  startLane: number;
  laneSpan: number;
  isFixed?: boolean;
};

// 各行の1レーンカードと複数レーンカードの配置
export type RowSlotState = {
  type: "lanes";
  cols: (number | null)[];
  wideCards: WideCardPlacement[];
};

// ドラッグ元（トレイか、あるいは左のスロットか）
type DragSource =
  | { type: "tray"; originalIndex: number }
  | { type: "slotWide"; row: number; originalIndex: number }
  | { type: "slotLane"; row: number; col: number };

// ドロップ先の当たり判定
type DropTarget =
  | { type: "wide"; row: number; startLane: number }
  | { type: "lane"; row: number; col: number };

// ドラッグ中の状態
type DragState = {
  card: Card;
  source: DragSource;
  pointerX: number;
  pointerY: number;
  offsetX: number;
  offsetY: number;
  displayWidth: number;
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
  id: number;
  value: number;
  x: number;
  y: number;
  scale: number;
  opacity: number;
  transition: string;
  isPopping?: boolean;
  isError?: boolean;
};

const EMPTY_FIXED_CARDS: FixedCard[] = [];

export default function PlayStage(props?: Partial<Stage>) {
  const params = useParams();
  const routeStageNumber = params.id ? parseInt(params.id, 10) : 1;
  const stageNumber = !Number.isNaN(routeStageNumber) ? routeStageNumber : 1;
  const currentStage = STAGES[stageNumber - 1] ?? STAGES[0];
  // 存在しない番号のときはステージ1を表示しているので、スコアもステージ1として扱う
  const scoreStageNumber = STAGES[stageNumber - 1] ? stageNumber : 1;

  const stage = useMemo(
    () => ({
      startNums: props?.startNums ?? currentStage.startNums,
      cards: props?.cards ?? currentStage.cards,
      fixedCards:
        props?.fixedCards ?? currentStage.fixedCards ?? EMPTY_FIXED_CARDS,
    }),
    [
      props?.startNums,
      props?.cards,
      props?.fixedCards,
      currentStage.startNums,
      currentStage.cards,
      currentStage.fixedCards,
    ]
  );

  const laneCount = stage.startNums.length;
  // スロット行数（4行固定）
  const SLOT_COUNT = 4;
  // トレイの最低スロット数（5スロット）
  const MIN_TRAY_COUNT = 5;

  // 固定カードのインデックスマップ (key: negative index -> FixedCard)
  const fixedCardsList = stage.fixedCards;

  const createInitialRows = useCallback(
    (lanes: number): RowSlotState[] => {
      const rows: RowSlotState[] = Array.from({ length: SLOT_COUNT }, () => ({
        type: "lanes",
        cols: Array.from({ length: lanes }, () => null),
        wideCards: [],
      }));

      fixedCardsList.forEach((fc, idx) => {
        const row = fc.row;
        if (row < 0 || row >= SLOT_COUNT) return;
        const fakeIndex = -(idx + 1);
        const cardLaneSpan = getCardLaneSpan(fc.card, lanes);
        if (cardLaneSpan === 1) {
          const lane = fc.lane ?? 0;
          if (lane >= 0 && lane < lanes) {
            rows[row].cols[lane] = fakeIndex;
          }
        } else {
          const startLane = Math.min(fc.lane ?? 0, lanes - cardLaneSpan);
          rows[row].wideCards.push({
            originalIndex: fakeIndex,
            startLane,
            laneSpan: cardLaneSpan,
            isFixed: true,
          });
        }
      });

      return rows;
    },
    [SLOT_COUNT, fixedCardsList]
  );

  // 左側のスロット行状態
  const [placedRows, setPlacedRows] = useState<RowSlotState[]>(() =>
    createInitialRows(stage.startNums.length)
  );


  // 出力結果表示用の平均値（初期値は0）
  const [outputAverage, setOutputAverage] = useState<number>(() => {
    return 0;
  }
  );
  // 出力結果表示用の数値配列（アニメーション等のフォールバック用）
  const [outputNums, setOutputNums] = useState<number[]>(stage.startNums);
  // 「平均」ボックスのハイライトフラグ
  const [isAverageActive, setIsAverageActive] = useState(false);
  // 実行中フラグ
  const [isExecuting, setIsExecuting] = useState(false);
  // 現在実行ハイライト中の行インデックス
  const [activeRow, setActiveRow] = useState<number | null>(null);
  // 現在実行ハイライト中のレーン（UnaryCard適用時）
  const [activeLanes, setActiveLanes] = useState<number[]>([]);
  // エラーメッセージ
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  // スコアポップアップ
  const [score, setScore] = useState<{
    stageNumber: number;
    result: number;
    usedAllCards: boolean;
  } | null>(null);

  // 移動する数字トークンのアニメーション状態
  const [movingTokens, setMovingTokens] = useState<MovingToken[] | null>(null);

  // ドラッグ＆ドロップ状態
  const [dragState, setDragState] = useState<DragState | null>(null);
  const [hoveredTarget, setHoveredTarget] = useState<DropTarget | null>(null);
  const [snapBack, setSnapBack] = useState<SnapBackState | null>(null);

  // 各要素の DOM Ref
  const pipelineContainerRef = useRef<HTMLDivElement | null>(null);
  const startNumsRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const averageBoxRef = useRef<HTMLDivElement | null>(null);
  const outputAvgRef = useRef<HTMLSpanElement | null>(null);
  const rowRefs = useRef<(HTMLDivElement | null)[]>([]);
  const laneSlotRefs = useRef<(HTMLDivElement | null)[][]>([]);
  const trayItemRefs = useRef<(HTMLDivElement | null)[]>([]);

  // ドラッグ判定用
  const dragStartPosRef = useRef<{ x: number; y: number } | null>(null);
  const dragStartTimeRef = useRef<number>(0);
  const hasMovedRef = useRef<boolean>(false);

  // ステージ切り替え時のリセット
  useEffect(() => {
    setPlacedRows(createInitialRows(stage.startNums.length));
    setOutputNums(stage.startNums);
    setOutputAverage(0);
    setIsAverageActive(false);
    setErrorMessage(null);
    setScore(null);
    setMovingTokens(null);
    setActiveRow(null);
    setActiveLanes([]);
  }, [stageNumber, stage.startNums, createInitialRows, 0]);

  const stageCards = stage.cards;

  // インデックスからカードを取得（正の数はトレイのカード、負の数は固定カード）
  const getCardByIndex = useCallback(
    (index: number): Card | undefined => {
      if (index >= 0) {
        return stageCards[index];
      }
      const fixedIdx = -index - 1;
      return fixedCardsList[fixedIdx]?.card;
    },
    [stageCards, fixedCardsList]
  );

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
  }, [stageCards, MIN_TRAY_COUNT]);

  // あるカードがすでにスロットに置かれているか判定
  const isCardPlaced = useCallback(
    (originalIndex: number): boolean => {
      for (const row of placedRows) {
        if (row.cols.includes(originalIndex)) return true;
        if (row.wideCards.some((placement) => placement.originalIndex === originalIndex)) {
          return true;
        }
      }
      return false;
    },
    [placedRows]
  );

  const getSourceCardIndex = useCallback(
    (source: DragSource): number | null => {
      if (source.type === "tray") return source.originalIndex;
      if (source.type === "slotWide") return source.originalIndex;
      return placedRows[source.row].cols[source.col];
    },
    [placedRows]
  );

  // ----------------------------------------------------
  // 当たり判定ロジック
  // ----------------------------------------------------
  const getHitTarget = useCallback(
    (
      x: number,
      y: number,
      card: Card,
      ignoredCardIndex?: number
    ): DropTarget | null => {
      const isUnary = isUnaryCard(card);
      const laneSpan = getCardLaneSpan(card, laneCount);

      const isLaneAvailable = (rowIndex: number, lane: number) => {
        const row = placedRows[rowIndex];
        if (row.cols[lane] !== null && row.cols[lane] !== ignoredCardIndex) {
          return false;
        }
        return !row.wideCards.some(
          (placement) =>
            placement.originalIndex !== ignoredCardIndex &&
            lane >= placement.startLane &&
            lane < placement.startLane + placement.laneSpan
        );
      };

      for (let r = 0; r < SLOT_COUNT; r++) {
        const rowEl = rowRefs.current[r];
        if (!rowEl) continue;
        const rowRect = rowEl.getBoundingClientRect();

        // 行の上下判定（少し広めにマージンを取る）
        if (y >= rowRect.top - 16 && y <= rowRect.bottom + 16) {
          if (!isUnary) {
            // 複数入力カードは、使うレーン数に合わせた幅で配置する。
            if (x >= rowRect.left - 24 && x <= rowRect.right + 24) {
              let closestStartLane = 0;
              let minDistance = Infinity;

              for (let startLane = 0; startLane <= laneCount - laneSpan; startLane++) {
                const lanesAvailable = Array.from(
                  { length: laneSpan },
                  (_, index) => isLaneAvailable(r, startLane + index)
                ).every(Boolean);
                if (!lanesAvailable) continue;

                const firstCell = laneSlotRefs.current[r]?.[startLane];
                const lastCell = laneSlotRefs.current[r]?.[startLane + laneSpan - 1];
                if (!firstCell || !lastCell) continue;

                const firstRect = firstCell.getBoundingClientRect();
                const lastRect = lastCell.getBoundingClientRect();
                const pairCenterX =
                  (firstRect.left + lastRect.right) / 2;
                const distance = Math.abs(x - pairCenterX);
                if (distance < minDistance) {
                  minDistance = distance;
                  closestStartLane = startLane;
                }
              }

              return minDistance < Infinity
                ? { type: "wide", row: r, startLane: closestStartLane }
                : null;
            }
          } else {
            // 1入力カード（UnaryCard）は各列スロットがターゲット
            if (laneCount === 1) {
              if (
                x >= rowRect.left - 24 &&
                x <= rowRect.right + 24 &&
                isLaneAvailable(r, 0)
              ) {
                return { type: "lane", row: r, col: 0 };
              }
            } else {
              // 各列のスロット矩形を判定
              for (let c = 0; c < laneCount; c++) {
                const cellEl = laneSlotRefs.current[r]?.[c];
                if (cellEl) {
                  const cellRect = cellEl.getBoundingClientRect();
                  if (!isLaneAvailable(r, c)) continue;
                  if (
                    x >= cellRect.left - 12 &&
                    x <= cellRect.right + 12 &&
                    y >= cellRect.top - 12 &&
                    y <= cellRect.bottom + 12
                  ) {
                    return { type: "lane", row: r, col: c };
                  }
                }
              }

              // 行内に入っていれば一番近い列を選択
              if (x >= rowRect.left - 20 && x <= rowRect.right + 20) {
                let nearestAvailableCol = -1;
                let nearestAvailableDistance = Infinity;
                for (let c = 0; c < laneCount; c++) {
                  if (!isLaneAvailable(r, c)) continue;
                  const cellEl = laneSlotRefs.current[r]?.[c];
                  if (!cellEl) continue;
                  const rect = cellEl.getBoundingClientRect();
                  const distance = Math.abs(x - (rect.left + rect.width / 2));
                  if (distance < nearestAvailableDistance) {
                    nearestAvailableDistance = distance;
                    nearestAvailableCol = c;
                  }
                }
                if (nearestAvailableCol >= 0) {
                  return { type: "lane", row: r, col: nearestAvailableCol };
                }
              }
            }
          }
        }
      }

      return null;
    },
    [SLOT_COUNT, laneCount, placedRows]
  );

  // ----------------------------------------------------
  // ドラッグ＆ドロップ（ホールドして運ぶ）ロジック
  // ----------------------------------------------------
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
      let displayWidth = rect.width;

      if (source.type === "tray") {
        const laneSpan = getCardLaneSpan(card, laneCount);
        const firstSlot = laneSlotRefs.current[0]?.[0]?.firstElementChild;
        const lastSlot =
          laneSlotRefs.current[0]?.[laneSpan - 1]?.firstElementChild;
        if (firstSlot instanceof HTMLElement && lastSlot instanceof HTMLElement) {
          const firstRect = firstSlot.getBoundingClientRect();
          const lastRect = lastSlot.getBoundingClientRect();
          displayWidth = lastRect.right - firstRect.left;
        }
      }

      dragStartPosRef.current = { x: e.clientX, y: e.clientY };
      dragStartTimeRef.current = Date.now();
      hasMovedRef.current = false;

      setDragState({
        card,
        source,
        pointerX: e.clientX,
        pointerY: e.clientY,
        offsetX: ((e.clientX - rect.left) / rect.width) * displayWidth,
        offsetY: e.clientY - rect.top,
        displayWidth,
        originRect: {
          left: rect.left,
          top: rect.top,
          width: rect.width,
          height: rect.height,
        },
      });

      const sourceRow =
        source.type === "slotWide" ? placedRows[source.row] : null;
      const initialHit =
        source.type === "slotWide"
          ? {
            type: "wide" as const,
            row: source.row,
            startLane:
              sourceRow?.wideCards.find(
                (placement) => placement.originalIndex === source.originalIndex
              )?.startLane ?? 0,
          }
          : source.type === "slotLane"
            ? { type: "lane" as const, row: source.row, col: source.col }
            : getHitTarget(e.clientX, e.clientY, card);

      setHoveredTarget(initialHit);
      setErrorMessage(null);
    },
    [isExecuting, getHitTarget, placedRows]
  );

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

      setHoveredTarget(
        getHitTarget(
          e.clientX,
          e.clientY,
          dragState.card,
          getSourceCardIndex(dragState.source) ?? undefined
        )
      );
    };

    const handlePointerUp = (e: PointerEvent) => {
      const currentDrag = dragState;
      const hitTarget =
        getHitTarget(
          e.clientX,
          e.clientY,
          currentDrag.card,
          getSourceCardIndex(currentDrag.source) ?? undefined
        ) ?? hoveredTarget;

      setDragState(null);
      setHoveredTarget(null);

      if (!currentDrag) return;

      if (hitTarget) {
        // === スロットの上にドロップ ===
        const cardIndex = getSourceCardIndex(currentDrag.source);

        if (cardIndex === null) return;

        setPlacedRows((prev) => {
          const next = prev.map((row) => {
            return {
              type: "lanes" as const,
              cols: row.cols.map((colIdx) => (colIdx === cardIndex ? null : colIdx)),
              wideCards: row.wideCards.filter(
                (placement) => placement.originalIndex !== cardIndex
              ),
            };
          });

          if (hitTarget.type === "wide") {
            const card = getCardByIndex(cardIndex);
            if (!card) return next;
            const laneSpan = getCardLaneSpan(card, laneCount);
            next[hitTarget.row].wideCards.push({
              originalIndex: cardIndex,
              startLane: Math.min(
                hitTarget.startLane,
                laneCount - laneSpan
              ),
              laneSpan,
            });
          } else {
            next[hitTarget.row].cols[hitTarget.col] = cardIndex;
          }

          return next;
        });
      } else {
        // === スロット外で離した（スロットから外す & スナップバック） ===
        let targetRect = currentDrag.originRect;

        if (currentDrag.source.type === "slotWide") {
          const fromRow = currentDrag.source.row;
          const origIdx = currentDrag.source.originalIndex;
          setPlacedRows((prev) => {
            const next = [...prev];
            next[fromRow] = {
              ...next[fromRow],
              wideCards: next[fromRow].wideCards.filter(
                (placement) => placement.originalIndex !== origIdx
              ),
            };
            return next;
          });
          if (origIdx !== null && trayItemRefs.current[origIdx]) {
            const r = trayItemRefs.current[origIdx]!.getBoundingClientRect();
            targetRect = { left: r.left, top: r.top, width: r.width, height: r.height };
          }
        } else if (currentDrag.source.type === "slotLane") {
          const { row: fromRow, col: fromCol } = currentDrag.source;
          const origIdx = placedRows[fromRow].cols[fromCol];
          setPlacedRows((prev) => {
            const next = [...prev];
            const nextCols = [...next[fromRow].cols];
            nextCols[fromCol] = null;
            next[fromRow] = { ...next[fromRow], cols: nextCols };
            return next;
          });
          if (origIdx !== null && trayItemRefs.current[origIdx]) {
            const r = trayItemRefs.current[origIdx]!.getBoundingClientRect();
            targetRect = { left: r.left, top: r.top, width: r.width, height: r.height };
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
  }, [
    dragState,
    hoveredTarget,
    placedRows,
    getHitTarget,
    getSourceCardIndex,
    stageCards,
    laneCount,
  ]);

  // スナップバックアニメーション駆動
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

  // スロットをクリックして外す処理
  const handleRemoveSlot = useCallback(
    (
      source:
        | { type: "wide"; row: number; originalIndex: number }
        | { type: "lane"; row: number; col: number }
    ) => {
      if (isExecuting) return;
      const holdDuration = Date.now() - dragStartTimeRef.current;
      if (hasMovedRef.current || holdDuration > 250) return;

      setPlacedRows((prev) => {
        const next = [...prev];
        if (source.type === "wide") {
          next[source.row] = {
            ...next[source.row],
            wideCards: next[source.row].wideCards.filter(
              (placement) => placement.originalIndex !== source.originalIndex
            ),
          };
        } else {
          const cols = [...next[source.row].cols];
          cols[source.col] = null;
          next[source.row] = { ...next[source.row], cols };
        }
        return next;
      });
      setErrorMessage(null);
    },
    [isExecuting]
  );

  // ----------------------------------------------------
  // 実行ボタンクリック時：数字が「同時に」移動しながら計算するアニメーション
  // ----------------------------------------------------
  const handleExecute = useCallback(async () => {
    if (isExecuting) return;

    const containerEl = pipelineContainerRef.current;
    if (!containerEl) return;

    const containerRect = containerEl.getBoundingClientRect();
    const getCenter = (el: HTMLElement) => {
      const r = el.getBoundingClientRect();
      return {
        x: r.left + r.width / 2 - containerRect.left,
        y: r.top + r.height / 2 - containerRect.top,
      };
    };

    setErrorMessage(null);
    setIsExecuting(true);
    setActiveRow(null);
    setActiveLanes([]);

    let currentVals = [...stage.startNums];
    setOutputNums(currentVals);

    // 1. 各レーンの開始数字の位置にトークンを配置
    const initialTokens: MovingToken[] = [];
    for (let c = 0; c < laneCount; c++) {
      const startEl = startNumsRefs.current[c];
      const pt = startEl
        ? getCenter(startEl)
        : { x: (containerRect.width / (laneCount + 1)) * (c + 1), y: 20 };
      initialTokens.push({
        id: c,
        value: currentVals[c],
        x: pt.x,
        y: pt.y,
        scale: 1,
        opacity: 1,
        transition: "none",
      });
    }
    setMovingTokens(initialTokens);

    await new Promise((r) => setTimeout(r, 80));

    // 2. 上部からスロット入り口（row 0 の上部）へ同時に移動
    setMovingTokens((prev) =>
      prev
        ? prev.map((t, c) => {
          const slotEl = laneSlotRefs.current[0]?.[c] ?? rowRefs.current[0];
          const pt = slotEl ? getCenter(slotEl) : { x: t.x, y: 50 };
          return {
            ...t,
            x: pt.x,
            y: pt.y - 36,
            transition:
              "left 200ms cubic-bezier(0.2, 0.8, 0.2, 1), top 200ms cubic-bezier(0.2, 0.8, 0.2, 1)",
          };
        })
        : null
    );
    await new Promise((r) => setTimeout(r, 220));

    // 3. 各行のカード位置で停止し、演算結果を反映
    let hasError = false;
    for (let r = 0; r < SLOT_COUNT; r++) {
      const rowState = placedRows[r];
      setMovingTokens((prev) =>
        prev
          ? prev.map((token, colIdx) => {
            const slotEl =
              laneSlotRefs.current[r]?.[colIdx] ?? rowRefs.current[r];
            const point = slotEl
              ? getCenter(slotEl)
              : { x: token.x, y: token.y + 60 };
            return {
              ...token,
              x: point.x,
              y: point.y,
              transition:
                "left 180ms cubic-bezier(0.2, 0.8, 0.2, 1), top 180ms cubic-bezier(0.2, 0.8, 0.2, 1)",
            };
          })
          : null
      );
      await new Promise((r) => setTimeout(r, 200));

      const activeCols = [
        ...rowState.wideCards.flatMap((placement) =>
          Array.from(
            { length: placement.laneSpan },
            (_, index) => placement.startLane + index
          )
        ),
        ...rowState.cols.flatMap((cardIndex, colIdx) =>
          cardIndex === null ? [] : [colIdx]
        ),
      ];
      let nextVals = [...currentVals];

      if (activeCols.length > 0) {
        setActiveRow(r);
        setActiveLanes(activeCols);
      }

      try {
        for (const placement of rowState.wideCards) {
          const card = getCardByIndex(placement.originalIndex);
          if (!card) continue;
          const inputs = currentVals.slice(
            placement.startLane,
            placement.startLane + placement.laneSpan
          );
          const result = applyCard(inputs, card);
          if (!result.success) {
            hasError = true;
            setErrorMessage(result.reason);
            break;
          }
          result.value.forEach((value, index) => {
            nextVals[placement.startLane + index] = value;
          });
        }
        if (!hasError) {
          for (let c = 0; c < laneCount; c++) {
            const cardIndex = rowState.cols[c];
            if (cardIndex === null) continue;
            const card = getCardByIndex(cardIndex);
            if (!card || !isUnaryCard(card)) continue;

            const result = applyUnaryCard(currentVals[c], card);
            if (!result.success) {
              hasError = true;
              setErrorMessage(result.reason);
              break;
            }
            nextVals[c] = result.value;
          }
        }
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
        setMovingTokens((prev) =>
          prev
            ? prev.map((token, colIdx) => ({
              ...token,
              isError: activeCols.includes(colIdx),
              scale: activeCols.includes(colIdx) ? 1.25 : 1,
              transition: "transform 180ms ease-in-out",
            }))
            : null
        );
        await new Promise((r) => setTimeout(r, 450));
        setActiveRow(null);
        setActiveLanes([]);
        break;
      }

      currentVals = nextVals;
      if (activeCols.length > 0) {
        setMovingTokens((prev) =>
          prev
            ? prev.map((token, colIdx) => ({
              ...token,
              value: currentVals[colIdx],
              scale: activeCols.includes(colIdx) ? 1.35 : 1,
              isPopping: activeCols.includes(colIdx),
              transition:
                "transform 140ms cubic-bezier(0.34, 1.56, 0.64, 1)",
            }))
            : null
        );
        await new Promise((r) => setTimeout(r, 160));

        setMovingTokens((prev) =>
          prev
            ? prev.map((token) => ({
              ...token,
              scale: 1,
              isPopping: false,
              transition: "transform 140ms ease-out",
            }))
            : null
        );
        await new Promise((r) => setTimeout(r, 180));
      } else {
        await new Promise((r) => setTimeout(r, 80));
      }

      setActiveRow(null);
      setActiveLanes([]);
    }

    if (!hasError) {
      const avgScoreRes = calculateAverageScore(currentVals);
      const avgScore = avgScoreRes.success ? avgScoreRes.value : currentVals[0];

      if (laneCount > 1) {
        // === 2, 3レーンの場合: 「平均」ボックスを経由して平均値を出力 ===
        const avgBoxEl = averageBoxRef.current;
        const avgCenter = avgBoxEl
          ? getCenter(avgBoxEl)
          : { x: containerRect.width / 2, y: containerRect.height - 60 };

        // 4a. 各トークンが「平均」ボックス内の自分の列位置へ下向き移動
        setMovingTokens((prev) =>
          prev
            ? prev.map((t) => ({
              ...t,
              y: avgCenter.y,
              transition: "top 200ms cubic-bezier(0.2, 0.8, 0.2, 1)",
            }))
            : null
        );
        await new Promise((r) => setTimeout(r, 220));

        // 4b. 「平均」ボックスをハイライトし、全トークンが中央にマージ
        setIsAverageActive(true);
        setMovingTokens((prev) =>
          prev
            ? prev.map((t) => ({
              ...t,
              x: avgCenter.x,
              transition: "left 200ms cubic-bezier(0.2, 0.8, 0.2, 1)",
            }))
            : null
        );
        await new Promise((r) => setTimeout(r, 220));

        // 4c. 合体・平均値のポップ演出（1つのトークンにまとめ、ポンッと弾む）
        setMovingTokens([
          {
            id: 0,
            value: avgScore,
            x: avgCenter.x,
            y: avgCenter.y,
            scale: 1.35,
            opacity: 1,
            isPopping: true,
            transition: "transform 140ms cubic-bezier(0.34, 1.56, 0.64, 1)",
          },
        ]);
        await new Promise((r) => setTimeout(r, 160));

        setMovingTokens((prev) =>
          prev
            ? prev.map((t) => ({
              ...t,
              scale: 1.0,
              isPopping: false,
              transition: "transform 140ms ease-out",
            }))
            : null
        );
        await new Promise((r) => setTimeout(r, 160));
        setIsAverageActive(false);

        // 4d. 下部折れ曲がり矢印の先（出力平均値）の位置へ移動
        const outAvgEl = outputAvgRef.current;
        const outPt = outAvgEl
          ? getCenter(outAvgEl)
          : { x: avgCenter.x + 54, y: avgCenter.y + 40 };

        setMovingTokens((prev) =>
          prev
            ? prev.map((t) => ({
              ...t,
              x: outPt.x,
              y: outPt.y,
              transition:
                "left 220ms cubic-bezier(0.2, 0.8, 0.2, 1), top 220ms cubic-bezier(0.2, 0.8, 0.2, 1)",
            }))
            : null
        );
        await new Promise((r) => setTimeout(r, 240));

        // 4e. 到着：出力数字を確定し、吸い込まれるようにフェードアウト
        setOutputAverage(avgScore);
        setOutputNums(currentVals);
        setMovingTokens((prev) =>
          prev
            ? prev.map((t) => ({
              ...t,
              scale: 1.25,
              opacity: 0,
              transition: "transform 200ms ease-out, opacity 200ms ease-out",
            }))
            : null
        );
        await new Promise((r) => setTimeout(r, 220));
      } else {
        // === 1レーンの場合: 直接下部出力位置へ移動 ===
        const outAvgEl = outputAvgRef.current;
        const outPt = outAvgEl
          ? getCenter(outAvgEl)
          : { x: containerRect.width / 2 + 54, y: containerRect.height - 30 };

        setMovingTokens((prev) =>
          prev
            ? prev.map((t) => ({
              ...t,
              x: outPt.x,
              y: outPt.y,
              transition:
                "left 200ms cubic-bezier(0.2, 0.8, 0.2, 1), top 200ms cubic-bezier(0.2, 0.8, 0.2, 1)",
            }))
            : null
        );
        await new Promise((r) => setTimeout(r, 220));

        setOutputAverage(avgScore);
        setOutputNums(currentVals);
        setMovingTokens((prev) =>
          prev
            ? prev.map((t) => ({
              ...t,
              scale: 1.25,
              opacity: 0,
              transition: "transform 200ms ease-out, opacity 200ms ease-out",
            }))
            : null
        );
        await new Promise((r) => setTimeout(r, 220));
      }

      // 6. スコア表示
      // すべての手札カードが配置されたか
      const placedSet = new Set<number>();
      for (const row of placedRows) {
        for (const placement of row.wideCards) {
          if (placement.originalIndex >= 0) {
            placedSet.add(placement.originalIndex);
          }
        }
        for (const idx of row.cols) {
          if (idx !== null && idx >= 0) {
            placedSet.add(idx);
          }
        }
      }
      const usedAllCards = placedSet.size === stageCards.length;

      setScore({
        stageNumber: scoreStageNumber,
        result: avgScore,
        usedAllCards,
      });
    }

    setMovingTokens(null);
    setActiveRow(null);
    setActiveLanes([]);
    setIsAverageActive(false);
    setIsExecuting(false);
  }, [
    isExecuting,
    stage.startNums,
    laneCount,
    SLOT_COUNT,
    placedRows,
    stageCards,
    scoreStageNumber,
  ]);

  // レーン数に応じた幅スタイルクラス
  const laneWidthClass =
    laneCount === 1
      ? "w-44 sm:w-48"
      : laneCount === 2
        ? "w-32 sm:w-36"
        : "w-24 sm:w-28";

  const totalGridWidthClass =
    laneCount === 1
      ? "w-44 sm:w-48"
      : laneCount === 2
        ? "w-[268px] sm:w-[300px]"
        : "w-[298px] sm:w-[346px]";

  const laneGapClass =
    laneCount === 1 ? "" : laneCount === 2 ? "gap-3" : "gap-2 sm:gap-2.5";

  const getTrayCardWidthClass = (card: Card) => {
    const cardLaneSpan = getCardLaneSpan(card, laneCount);
    if (cardLaneSpan === laneCount) return totalGridWidthClass;
    if (cardLaneSpan === 1) return laneWidthClass;
    return "w-[196px] sm:w-[227px]";
  };

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
      <div className="relative z-10 flex flex-col sm:flex-row items-center justify-center gap-8 sm:gap-14 md:gap-20 pt-16 sm:pt-4">
        {/* 左側カラム: パイプライン（開始数 → 4行スロット → 出力数） */}
        <div
          ref={pipelineContainerRef}
          className="relative flex flex-col items-center"
        >
          {/* 上部矢印と開始数字 */}
          <div
            className={`relative flex items-center justify-between ${laneGapClass} ${totalGridWidthClass} select-none h-14`}
          >
            {stage.startNums.map((num, colIdx) => {
              // レーン数に応じた矢印開始位置と数字のオフセット
              const arrowStartX =
                laneCount === 1 ? -60 : laneCount === 2 ? -54 : -38;
              const numRightOffset =
                laneCount === 1
                  ? "calc(50% + 72px)"
                  : laneCount === 2
                    ? "calc(50% + 64px)"
                    : "calc(50% + 46px)";

              return (
                <div
                  key={`start-col-${colIdx}`}
                  className={`relative flex-1 ${laneWidthClass} h-full flex items-center justify-center`}
                >
                  {/* 開始数字 */}
                  <span
                    ref={(el) => {
                      startNumsRefs.current[colIdx] = el;
                    }}
                    className={`absolute font-serif text-2xl text-[#2d2d2d] transition-opacity duration-200 pointer-events-none whitespace-nowrap ${movingTokens ? "opacity-35" : "opacity-100"
                      }`}
                    style={{
                      right: numRightOffset,
                      top: "5px",
                      fontFamily:
                        "'Noto Serif JP', 'Hiragino Mincho ProN', 'Yu Mincho', serif",
                    }}
                  >
                    {num}
                  </span>

                  {/* 折れ曲がり矢印SVG: スロット中央(50%)を基準に描画 */}
                  <div className="absolute left-1/2 top-0 -translate-x-1/2 w-0 h-full pointer-events-none overflow-visible">
                    <svg className="overflow-visible" width="1" height="56">
                      {/* 水平線 (arrowStartX, 18) -> (0, 18), 垂直線 (0, 18) -> (0, 44) */}
                      <path
                        d={`M ${arrowStartX} 18 L 0 18 L 0 44`}
                        fill="none"
                        stroke="#2d2d2d"
                        strokeWidth="1.8"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                      {/* 矢印先端 (↓) */}
                      <polyline
                        points="-6 38, 0 44, 6 38"
                        fill="none"
                        stroke="#2d2d2d"
                        strokeWidth="1.8"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </div>
                </div>
              );
            })}
          </div>

          {/* 4行のスロット */}
          <div className="flex flex-col gap-3.5 my-1">
            {Array.from({ length: SLOT_COUNT }).map((_, rowIdx) => {
              const rowState = placedRows[rowIdx];
              const isRowActive = activeRow === rowIdx;

              return (
                <div
                  key={`row-${rowIdx}`}
                  ref={(el) => {
                    rowRefs.current[rowIdx] = el;
                  }}
                  className={`relative grid items-center ${laneGapClass} ${totalGridWidthClass}`}
                  style={{
                    gridTemplateColumns: `repeat(${laneCount}, minmax(0, 1fr))`,
                  }}
                >
                  {Array.from({ length: laneCount }).map((_, colIdx) => {
                    const cardIndex = rowState.cols[colIdx];
                    const card =
                      cardIndex !== null ? getCardByIndex(cardIndex) : undefined;
                    const isFixed = cardIndex !== null && cardIndex < 0;
                    const coveringWideCard = rowState.wideCards.some(
                      (placement) =>
                        colIdx >= placement.startLane &&
                        colIdx < placement.startLane + placement.laneSpan
                    );

                    const isCellActive =
                      isRowActive && activeLanes.includes(colIdx);
                    const isLaneDropTarget =
                      hoveredTarget?.type === "lane" &&
                      hoveredTarget.row === rowIdx &&
                      hoveredTarget.col === colIdx;

                    const isWideDropTarget =
                      hoveredTarget?.type === "wide" &&
                      hoveredTarget.row === rowIdx &&
                      dragState !== null &&
                      colIdx >= hoveredTarget.startLane &&
                      colIdx < hoveredTarget.startLane +
                      getCardLaneSpan(dragState.card, laneCount);
                    const isDropTarget =
                      isLaneDropTarget || isWideDropTarget;

                    const isSlotDragging =
                      dragState?.source.type === "slotLane" &&
                      dragState.source.row === rowIdx &&
                      dragState.source.col === colIdx;

                    return (
                      <div
                        key={`cell-${rowIdx}-${colIdx}`}
                        ref={(el) => {
                          if (!laneSlotRefs.current[rowIdx]) {
                            laneSlotRefs.current[rowIdx] = [];
                          }
                          laneSlotRefs.current[rowIdx][colIdx] = el;
                        }}
                        className={`relative touch-none flex h-[50px] items-center justify-center`}
                      >
                        <OperationTile
                          card={card}
                          emptyVariant="solid"
                          isDropTarget={isDropTarget}
                          isGhost={isSlotDragging}
                          isFixed={isFixed}
                          style={{
                            visibility: coveringWideCard ? "hidden" : undefined,
                          }}
                          onPointerDown={
                            card && !isFixed && !isExecuting
                              ? (e) =>
                                handlePointerDown(
                                  e,
                                  { type: "slotLane", row: rowIdx, col: colIdx },
                                  card
                                )
                              : undefined
                          }
                          onClick={
                            card && !isFixed && !isExecuting
                              ? () =>
                                handleRemoveSlot({
                                  type: "lane",
                                  row: rowIdx,
                                  col: colIdx,
                                })
                              : undefined
                          }
                          className={`w-full ${laneWidthClass} transition-all duration-150 ${isCellActive && !coveringWideCard
                            ? "ring-2 ring-[#f6ba52] brightness-105 shadow-[0_0_12px_rgba(246,186,82,0.5)]"
                            : ""
                            } ${card && !isFixed && !isExecuting
                              ? "cursor-grab active:cursor-grabbing hover:brightness-95"
                              : ""
                            }`}
                        />
                      </div>
                    );
                  })}
                  <div
                    className={`pointer-events-none absolute inset-0 grid ${laneGapClass}`}
                    style={{
                      gridTemplateColumns: `repeat(${laneCount}, minmax(0, 1fr))`,
                    }}
                  >
                    {rowState.wideCards.map((placement) => {
                      const card = getCardByIndex(placement.originalIndex);
                      const isFixed = placement.isFixed || placement.originalIndex < 0;
                      const isSlotDragging =
                        dragState?.source.type === "slotWide" &&
                        dragState.source.row === rowIdx &&
                        dragState.source.originalIndex === placement.originalIndex;
                      const isDropTarget =
                        hoveredTarget?.type === "wide" &&
                        hoveredTarget.row === rowIdx &&
                        hoveredTarget.startLane === placement.startLane;
                      const isCardActive = Array.from(
                        { length: placement.laneSpan },
                        (_, index) => placement.startLane + index
                      ).some((colIdx) => activeLanes.includes(colIdx));

                      return (
                        <OperationTile
                          key={`wide-card-${rowIdx}-${placement.originalIndex}`}
                          card={card}
                          emptyVariant="solid"
                          isDropTarget={isDropTarget}
                          isGhost={isSlotDragging}
                          isFixed={isFixed}
                          onPointerDown={
                            !isFixed && !isExecuting && card
                              ? (e) =>
                                handlePointerDown(
                                  e,
                                  {
                                    type: "slotWide",
                                    row: rowIdx,
                                    originalIndex: placement.originalIndex,
                                  },
                                  card
                                )
                              : undefined
                          }
                          onClick={
                            !isFixed && !isExecuting
                              ? () =>
                                handleRemoveSlot({
                                  type: "wide",
                                  row: rowIdx,
                                  originalIndex: placement.originalIndex,
                                })
                              : undefined
                          }
                          className={`pointer-events-auto w-full transition-all duration-150 ${isRowActive && isCardActive
                            ? "ring-2 ring-[#f6ba52] brightness-105 shadow-[0_0_12px_rgba(246,186,82,0.5)]"
                            : ""
                            } ${!isFixed && !isExecuting
                              ? "cursor-grab active:cursor-grabbing hover:brightness-95"
                              : ""
                            }`}
                          style={{
                            gridColumn: `${placement.startLane + 1} / span ${placement.laneSpan}`,
                          }}
                        />
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>

          {/* 「平均」ボックス（2, 3レーン時に全幅で表示） */}
          {laneCount > 1 && (
            <div
              ref={averageBoxRef}
              className={`relative flex items-center justify-center ${totalGridWidthClass} h-[46px] sm:h-[50px] rounded-[6px] font-serif text-xl sm:text-2xl font-medium tracking-wider select-none bg-[#d9d9d9] border border-[#4a4a48] text-[#2d2d2d] shadow-[0_4px_6px_rgba(0,0,0,0.25)] transition-all duration-150 my-1 ${isAverageActive
                ? "ring-2 ring-[#f6ba52] brightness-105 shadow-[0_0_12px_rgba(246,186,82,0.5)]"
                : ""
                }`}
            >
              平均
            </div>
          )}

          {/* 下部フッター（下向き直角折れ曲がり矢印と平均結果数字） */}
          <div
            className={`relative flex items-center justify-center h-14 ${totalGridWidthClass} select-none`}
          >
            {/* スロット/平均ボックス中央から下に降りて右折する矢印 */}
            <div className="absolute left-1/2 top-0 -translate-x-1/2 w-0 h-full pointer-events-none overflow-visible">
              <svg className="overflow-visible" width="1" height="56">
                {/* (0, 0) -> (0, 22) -> (42, 22) */}
                <path
                  d="M 0 0 L 0 22 L 42 22"
                  fill="none"
                  stroke="#2d2d2d"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                {/* 矢印先端 (→) */}
                <polyline
                  points="36 16, 42 22, 36 28"
                  fill="none"
                  stroke="#2d2d2d"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>

            {/* 出力結果数字（平均値） */}
            <span
              ref={outputAvgRef}
              className={`absolute font-serif text-2xl text-[#2d2d2d] transition-transform duration-200 pointer-events-none whitespace-nowrap ${!isExecuting ? "scale-100" : ""
                }`}
              style={{
                left: "calc(50% + 56px)",
                top: "8px",
                fontFamily:
                  "'Noto Serif JP', 'Hiragino Mincho ProN', 'Yu Mincho', serif",
              }}
            >
              {formatDisplayNumber(outputAverage)}
            </span>
          </div>

          {/* 移動する数字トークン（実行時に経路を移動し、値が変化する） */}
          {movingTokens &&
            movingTokens.map((token) => (
              <div
                key={`moving-token-${token.id}`}
                style={{
                  position: "absolute",
                  left: `${token.x}px`,
                  top: `${token.y}px`,
                  transform: `translate(-50%, -50%) scale(${token.scale})`,
                  transition: token.transition,
                  opacity: token.opacity,
                }}
                className={`z-30 pointer-events-none flex items-center justify-center min-w-10 h-10 px-3 rounded-full font-serif font-bold text-lg whitespace-nowrap shadow-[0_4px_16px_rgba(0,0,0,0.2)] ${token.isError
                  ? "bg-red-50 border-2 border-red-500 text-red-600 ring-4 ring-red-200"
                  : token.isPopping
                    ? "bg-[#fff8e6] border-2 border-[#f6ba52] text-[#2d2d2d] ring-4 ring-[#f6ba52]/40 shadow-[0_0_20px_rgba(246,186,82,0.8)]"
                    : "bg-[#fdfcf9] border-2 border-[#f6ba52] text-[#2d2d2d]"
                  }`}
              >
                {formatDisplayNumber(token.value)}
              </div>
            ))}
        </div>

        {/* 右側カラム: トレイ（白いカードコンテナ） & 実行ボタン */}
        <div className="flex flex-col items-center">
          {/* 白いカードコンテナ */}
          <div className="bg-[#fdfcf9] rounded-2xl p-5 sm:p-6 shadow-[0_4px_24px_rgba(0,0,0,0.06)] border border-black/[0.03]">
            <div className={`flex flex-col gap-3.5 ${totalGridWidthClass}`}>
              {traySlots.map((item, index) => {
                if (!item) {
                  return <OperationTile key={`empty-${index}`} className="w-full" />;
                }

                const isPlaced = isCardPlaced(item.originalIndex);
                const isTrayDragging =
                  dragState?.source.type === "tray" &&
                  dragState.source.originalIndex === item.originalIndex;

                return (
                  <div
                    key={`tray-${item.originalIndex}`}
                    className="relative flex w-full touch-none justify-start"
                  >
                    <OperationTile
                      ref={(el) => {
                        trayItemRefs.current[item.originalIndex] = el;
                      }}
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
                      className={`${getTrayCardWidthClass(item.card)} ${isPlaced
                        ? "opacity-30 cursor-not-allowed"
                        : "cursor-grab active:cursor-grabbing hover:brightness-95"
                        }`}
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
            className="mt-6 w-44 sm:w-48 h-[46px] rounded-xl bg-[#f6ba52] hover:bg-[#efa93c] active:bg-[#e49c2c] active:scale-[0.98] shadow-[0_3px_10px_rgba(244,184,85,0.35)] transition-all duration-150 flex items-center justify-center font-serif text-[#6b5832] text-xl tracking-[0.25em] pl-[0.25em] select-none cursor-pointer disabled:opacity-75 disabled:cursor-not-allowed"
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
            width: `${dragState.displayWidth}px`,
            height: `${dragState.originRect.height}px`,
            pointerEvents: "none",
            zIndex: 100,
            transform: "scale(1.05) rotate(1.2deg)",
          }}
          className="shadow-[0_16px_32px_rgba(0,0,0,0.22)] ring-2 ring-[#f6ba52]/70 rounded-[6px]"
        >
          <OperationTile card={dragState.card} className="w-full h-full" />
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
          <OperationTile card={snapBack.card} className="w-full h-full" />
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
