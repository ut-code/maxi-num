import React, {
    forwardRef,
    useCallback,
    useLayoutEffect,
    useMemo,
    useRef,
    useState,
} from "react";
import type { Card } from "~/stages";

type NumberPair = [number, number];
export type UnaryOperation = (x: number) => number; // 1つ → 1つ
export type PairOperation = (pair: NumberPair) => NumberPair; // 2つ → 2つ
export type Operation = UnaryOperation | PairOperation;

export type OperationTileProps = {
    /**
     * 表示する演算の内容 (例: "+3", "×2", "-1", "反転" など)
     */
    label?: React.ReactNode;
    /**
     * stages.ts の Card オブジェクトを指定した場合の自動フォーマット対応
     */
    card?: Card;
    /**
     * クリック時のハンドラ
     */
    onClick?: (e: React.MouseEvent<HTMLElement>) => void;
    /**
     * ポインタ押下時のハンドラ（ドラッグ開始用）
     */
    onPointerDown?: (e: React.PointerEvent<HTMLElement>) => void;
    /**
     * 無効化状態
     */
    disabled?: boolean;
    /**
     * 追加のスタイルクラス
     */
    className?: string;
    /**
     * 追加のインラインスタイル
     */
    style?: React.CSSProperties;
    /**
     * ドロップターゲットとしてハイライト中か
     */
    isDropTarget?: boolean;
    /**
     * ゴースト状態（ドラッグ中の元位置プレースホルダーなど）
     */
    isGhost?: boolean;
    /**
     * 空（カード未配置）のときの表示形式 ('dashed': 破線, 'solid': 実線・背景色あり)
     */
    emptyVariant?: "dashed" | "solid";
    /**
     * 固定カード（移動不可）かどうか
     */
    isFixed?: boolean;
    /**
     * 盤面のスロットに配置済みかどうか
     */
    isPlaced?: boolean;
};

/**
 * Card オブジェクトを、改行してよい位置で区切った文字列の配列に変換
 * (例: "2で割った余り" → ["2で", "割った", "余り"])
 */
export function getOperationCardSegments(card: Card): string[] {
    switch (card.type) {
        case "plus":
            return [`${card.value}を`, "足す"];
        case "minus":
            return [`${card.value}を`, "引く"];
        case "multiply":
            return [`${card.value}を`, "かける"];
        case "divide":
            return [`${card.value}で`, "割る"];
        case "mod":
            return [`${card.value}で`, "割った", "余り"];
        case "backwards":
            return ["反転する"];
        case "divisorCount":
            return ["約数の", "個数"];
        case "divmod":
            return ["商と", "余り"];
        case "gcdLcm":
            return ["最大公約数と", "最小公倍数"];
        case "ratio":
            return ["比にする"];
        case "sortAsc":
            return ["左から", "小さい順に", "並べる"];
        case "ratio3":
            return ["3つの数の", "比にする"];
        default: {
            const _exhaustiveCheck: never = card;
            return [];
        }
    }
}

/**
 * Card オブジェクトを表示用の文字列に変換
 */
export function formatOperationCard(card: Card): string {
    return getOperationCardSegments(card).join("");
}

// カード内の文字の大きさの上限 (px)。1行のときは大きく、2行のときは高さに収まる大きさまで
const MAX_FONT_SIZE_ONE_LINE = 24;
const MAX_FONT_SIZE_TWO_LINES = 17;
const MIN_FONT_SIZE = 10;
// 左右の余白の合計 (px)
const HORIZONTAL_PADDING = 14;

// 文字列の幅を em 単位で見積もる (全角文字は 1em、半角の数字・記号は約 0.6em、tracking-wider 分を加算)
function estimateTextWidthEm(text: string): number {
    let width = 0;
    for (const ch of text) {
        width += (/[\x20-\x7e]/.test(ch) ? 0.6 : 1) + 0.05;
    }
    return width;
}

type LabelLayout = { lines: string[]; fontSize: number };

/**
 * カードの幅に合わせて、1行で表示するか、区切り位置で2行に分けるかを決める。
 * 文字が一番大きく表示できる並べ方を選ぶ (同じなら行数の少ない方)。
 */
function chooseLabelLayout(segments: string[], width: number): LabelLayout {
    const available = Math.max(width - HORIZONTAL_PADDING, 1);
    const candidates: { lines: string[]; maxFontSize: number }[] = [
        { lines: [segments.join("")], maxFontSize: MAX_FONT_SIZE_ONE_LINE },
    ];
    for (let i = 1; i < segments.length; i += 1) {
        candidates.push({
            lines: [segments.slice(0, i).join(""), segments.slice(i).join("")],
            maxFontSize: MAX_FONT_SIZE_TWO_LINES,
        });
    }

    let best: LabelLayout | null = null;
    for (const { lines, maxFontSize } of candidates) {
        const widestEm = Math.max(...lines.map(estimateTextWidthEm));
        const fontSize = Math.max(
            Math.min(maxFontSize, Math.floor(available / widestEm)),
            MIN_FONT_SIZE
        );
        if (!best || fontSize > best.fontSize) best = { lines, fontSize };
    }
    return best ?? { lines: [], fontSize: MAX_FONT_SIZE_ONE_LINE };
}

export const OperationTile = forwardRef<HTMLDivElement, OperationTileProps>(
    function OperationTile(
        {
            card,
            onClick,
            onPointerDown,
            disabled = false,
            className = "",
            style,
            isDropTarget = false,
            isGhost = false,
            emptyVariant = "dashed",
            isFixed = false,
            isPlaced = false,
        },
        ref
    ) {
        // カードの幅を測って、文字の並べ方と大きさを決める
        const tileRef = useRef<HTMLDivElement | null>(null);
        const [tileWidth, setTileWidth] = useState<number | null>(null);
        const setRefs = useCallback(
            (el: HTMLDivElement | null) => {
                tileRef.current = el;
                if (typeof ref === "function") ref(el);
                else if (ref) ref.current = el;
            },
            [ref]
        );
        useLayoutEffect(() => {
            const el = tileRef.current;
            if (!el) return;
            setTileWidth(el.offsetWidth);
            const observer = new ResizeObserver(() => setTileWidth(el.offsetWidth));
            observer.observe(el);
            return () => observer.disconnect();
        }, []);

        const segments = useMemo(
            () => (card ? getOperationCardSegments(card) : null),
            [card]
        );
        const layout = useMemo(
            () =>
                segments && tileWidth !== null
                    ? chooseLabelLayout(segments, tileWidth)
                    : null,
            [segments, tileWidth]
        );
        const isEmpty = segments === null;

        // 幅を測る前 (サーバー描画時など) は、区切り位置でだけ折り返す
        const content: React.ReactNode = isEmpty ? null : layout ? (
            <span
                className="flex flex-col items-center text-center leading-[1.2] whitespace-nowrap"
                style={{ fontSize: `${layout.fontSize}px` }}
            >
                {layout.lines.map((line, i) => (
                    <span key={i}>{line}</span>
                ))}
            </span>
        ) : (
            <span className="text-center text-base leading-[1.2]">
                {segments.map((segment, i) => (
                    <span key={i} className="inline-block">
                        {segment}
                    </span>
                ))}
            </span>
        );

        let appearanceStyle =
            "bg-[#d3f3f3] border border-[#4a4a48] text-[#2d2d2d] shadow-[0_4px_6px_rgba(0,0,0,0.25)]";

        if (isEmpty) {
            appearanceStyle =
                emptyVariant === "solid"
                    ? "bg-[#d9d9d9] border border-[#4a4a48] text-[#2d2d2d] shadow-[inset_0_3px_6px_rgba(0,0,0,0.2)]"
                    : "bg-[#e8e6df]/45 border border-dashed border-[#b8b5ad] shadow-none";
        }

        if (isFixed) {
            appearanceStyle =
                "bg-[#d9d9d9] border border-[#4a4a48] text-[#2d2d2d] shadow-[0_4px_6px_rgba(0,0,0,0.25)]";
        } else if (isPlaced) {
            appearanceStyle =
                "bg-[#93e6ef] border border-[#4a4a48] text-[#2d2d2d] shadow-[0_4px_6px_rgba(0,0,0,0.25)]";
        }

        if (isDropTarget) {
            appearanceStyle =
                "bg-[#93e6ef] border-2 border-dashed border-[#4a4a48] text-[#2d2d2d] shadow-[0_0_14px_rgba(147,230,239,0.55)] scale-[1.02]";
        } else if (isGhost) {
            appearanceStyle =
                "bg-[#d9d9d9]/35 border border-dashed border-[#999] opacity-40 shadow-none";
        }

        const widthStyle = /\bw-[^\s]+/.test(className) ? "" : "w-48";
        const baseStyle = `relative flex items-center justify-center ${widthStyle} h-[50px] rounded-[6px] px-[7px] font-serif font-medium tracking-wider select-none transition-all duration-150`;

        const interactiveStyle =
            !disabled && (onClick || onPointerDown)
                ? "cursor-grab active:cursor-grabbing hover:brightness-95"
                : "";

        const disabledStyle = disabled ? "opacity-40 cursor-not-allowed pointer-events-none" : "";

        return (
            <div
                ref={setRefs}
                role={onClick || onPointerDown ? "button" : undefined}
                tabIndex={onClick || onPointerDown ? 0 : undefined}
                onClick={!disabled ? onClick : undefined}
                onPointerDown={!disabled ? onPointerDown : undefined}
                style={style}
                className={`${baseStyle} ${appearanceStyle} ${interactiveStyle} ${disabledStyle} ${className}`}
            >
                {content}
            </div>
        );
    }
);
