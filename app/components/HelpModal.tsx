import { useEffect, useId, useRef, useState } from "react";
import { formatOperationCard } from "~/components/OperationTile";
import type { Card, Stage } from "~/stages";

type HelpModalProps = {
    stage: Pick<Stage, "cards" | "fixedCards">;
};

function describeCard(card: Card): string {
    switch (card.type) {
        case "plus":
            return `選んだ数に${card.value}を足します。`;
        case "minus":
            return `選んだ数から${card.value}を引きます。`;
        case "multiply":
            return `選んだ数に${card.value}をかけます。`;
        case "divide":
            return `選んだ数を${card.value}で割り、商の整数部分にします。`;
        case "mod":
            return `選んだ数を${card.value}で割った余りにします。`;
        case "backwards":
            return "数字の並びを逆順にします（例：123 → 321）。";
        case "divisorCount":
            return "数の正の約数の個数を数えます。";
        case "divmod":
            return "左の数を右の数で割り、左の数を商に、右の数を余りに置き換えます。";
        case "gcdLcm":
            return "左の数を最大公約数に、右の数を最小公倍数に置き換えます。";
        case "ratio":
            return "2つの数を、最大公約数で約分します。";
        case "sortAsc":
            return "入力された数を左から小さい順に並べ替えます。";
        case "ratio3":
            return "3つの数を、最大公約数で約分します。";
        default: {
            const exhaustiveCheck: never = card;
            return exhaustiveCheck;
        }
    }
}

function getCardKey(card: Card): string {
    return "value" in card ? `${card.type}:${card.value}` : card.type;
}

function deduplicateCards(cards: readonly Card[]): Card[] {
    return [...new Map(cards.map((card) => [getCardKey(card), card])).values()];
}

function CardList({ cards }: { cards: readonly Card[] }) {
    if (cards.length === 0) {
        return <p className="text-lg text-[#706c65]">このステージにカードはありません。</p>;
    }

    return (
        <ul className="space-y-2">
            {cards.map((card) => (
                <li
                    key={getCardKey(card)}
                    className="rounded-lg bg-[#f7f5f0] px-3 py-2"
                >
                    <p className="text-xl font-medium text-[#383631]">{formatOperationCard(card)}</p>
                    <p className="mt-0.5 text-lg leading-relaxed text-[#706c65]">
                        {describeCard(card)}
                    </p>
                </li>
            ))}
        </ul>
    );
}

export function HelpModal({ stage }: HelpModalProps) {
    const [isOpen, setIsOpen] = useState(false);
    const dialogId = useId();
    const closeButtonRef = useRef<HTMLButtonElement>(null);
    const cards = deduplicateCards([
        ...stage.cards,
        ...(stage.fixedCards ?? []).map(({ card }) => card),
    ]);
    useEffect(() => {
        if (!isOpen) return;

        closeButtonRef.current?.focus();
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === "Escape") setIsOpen(false);
        };

        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [isOpen]);

    return (
        <>
            <button
                type="button"
                aria-label="ヘルプを開く"
                aria-expanded={isOpen}
                aria-controls={dialogId}
                onClick={() => setIsOpen(true)}
                className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white text-3xl font-serif text-[#504d49] shadow-[0_2px_8px_rgba(0,0,0,0.12)] transition-colors hover:bg-[#f1efe9] active:scale-95"
            >
                ?
            </button>

            {isOpen && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
                    onClick={(event) => {
                        if (event.target === event.currentTarget) setIsOpen(false);
                    }}
                >
                    <section
                        id={dialogId}
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby={`${dialogId}-title`}
                        className="flex max-h-[calc(100vh-2rem)] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
                    >
                        <header className="flex items-center justify-between border-b border-[#e8e6df] px-8 py-6">
                            <h2 id={`${dialogId}-title`} className="text-2xl text-[#383631]">
                                ヘルプ
                            </h2>
                            <button
                                ref={closeButtonRef}
                                type="button"
                                aria-label="ヘルプを閉じる"
                                onClick={() => setIsOpen(false)}
                                className="flex h-9 w-9 items-center justify-center rounded-lg text-3xl leading-none text-[#706c65] hover:bg-[#f1efe9]"
                            >
                                ×
                            </button>
                        </header>

                        <div className="overflow-y-auto px-8 py-6 text-[#504d49]">
                            <section aria-labelledby={`${dialogId}-how-to-play`}>
                                <h3
                                    id={`${dialogId}-how-to-play`}
                                    className="mb-2 text-xl font-semibold text-[#383631]"
                                >
                                    ゲームの遊び方
                                </h3>
                                <p className="text-lg leading-relaxed">
                                    与えられた数字にカードの計算を順番に適用し、なるべく大きな数値を目指すゲームです。
                                    右にある手札のカードを左のスロットに配置して実行ボタンを押すと、上の行から順に計算します。
                                    鍵付きのカードを動かすことはできません。
                                    なお、すべてのスロットが埋まっていないとスコアが算出されません。
                                </p>
                            </section>

                            <section aria-label="このステージのカード" className="mt-5">
                                <CardList cards={cards} />
                            </section>
                        </div>
                    </section>
                </div>
            )}
        </>
    );
}