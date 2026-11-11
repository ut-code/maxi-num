import React, { forwardRef } from "react";
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
};

/**
 * Card オブジェクトを表示用の文字列に変換
 */
export function formatOperationCard(card: Card): string {
    switch (card.type) {
        case "plus":
            return `${card.value}を足す`;
        case "minus":
            return `${card.value}を引く`;
        case "multiply":
            return `${card.value}をかける`;
        case "divide":
            return `${card.value}でわった整数部分`;
        case "mod":
            return `${card.value}でわった余り`;
        case "backwards":
            return "反転する";
        case "divisorCount":
            return "約数する";
        case "divmod":
            return "商と余り";
        case "gcdLcm":
            return "最大公約数と最小公倍数";
        case "ratio":
            return "比にする";
        case "sortAsc":
            return "小さい順に並べる";
        case "ratio3":
            return "3数の比にする";
        default: {
            const _exhaustiveCheck: never = card;
            return "";
        }
    }
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
        },
        ref
    ) {
        // 表示するテキスト・要素の決定
        let content: React.ReactNode = card ? formatOperationCard(card) : null;
        const isEmpty = content === null;
        const fontSizeStyle =
            typeof content === "string" && content.length > 10
                ? "text-xs sm:text-sm px-1 text-center leading-tight"
                : typeof content === "string" && content.length > 6
                    ? "text-base sm:text-lg px-2 text-center"
                    : typeof content === "string" && content.length > 4
                        ? "text-xl px-2 text-center"
                        : "text-2xl";

        let appearanceStyle =
            "bg-[#d9d9d9] border border-[#4a4a48] text-[#2d2d2d] shadow-[0_4px_6px_rgba(0,0,0,0.25)]";

        if (isEmpty) {
            appearanceStyle =
                emptyVariant === "solid"
                    ? "bg-[#d9d9d9] border border-[#4a4a48] text-[#2d2d2d] shadow-[inset_0_3px_6px_rgba(0,0,0,0.2)]"
                    : "bg-[#e8e6df]/45 border border-dashed border-[#b8b5ad] shadow-none";
        }

        if (isDropTarget) {
            appearanceStyle =
                "bg-[#fff9eb] border-2 border-dashed border-[#f6ba52] text-[#2d2d2d] shadow-[0_0_14px_rgba(246,186,82,0.45)] scale-[1.02]";
        } else if (isGhost) {
            appearanceStyle =
                "bg-[#d9d9d9]/35 border border-dashed border-[#999] opacity-40 shadow-none";
        }

        const widthStyle = /\bw-[^\s]+/.test(className) ? "" : "w-48";
        const baseStyle = `relative flex items-center justify-center ${widthStyle} h-[50px] rounded-[6px] font-serif ${fontSizeStyle} font-medium tracking-wider select-none transition-all duration-150`;

        const interactiveStyle =
            !disabled && (onClick || onPointerDown)
                ? "cursor-grab active:cursor-grabbing hover:brightness-95"
                : "";

        const disabledStyle = disabled ? "opacity-40 cursor-not-allowed pointer-events-none" : "";

        return (
            <div
                ref={ref}
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
