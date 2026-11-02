import type { Card } from "./stages";

// 逆から読んだ数字を計算する関数。
export function reverseDigits(value: number): number {
  if (!Number.isSafeInteger(value)) {
    throw new Error(
      "数字の反転には、安全に扱える範囲の整数が必要です。"
    );
  }

// 絶対値を取ってから一度文字列に変換して、再び数字に戻す。
  const absoluteValue = Math.abs(value);
  const digits = String(absoluteValue);
  const reversedDigits = digits.split("").reverse().join("");
  const reversedValue = Number(reversedDigits);

  if (!Number.isSafeInteger(reversedValue)) {
    throw new Error(
      "反転後の数値が、安全に扱える整数の範囲を超えました。"
    );
  }

  return value < 0 ? -reversedValue : reversedValue;
}

// 正の約数の個数を計算する関数。
export function countDivisors(value: number): number {
  if (!Number.isSafeInteger(value)) {
    throw new Error(
      "約数の計算には、安全に扱える範囲の整数が必要です。"
    );
  }

  if (value === 0) {
    throw new Error(
      "0の正の約数の個数は、有限の数として返せません。"
    );
  }

//   絶対値の平方根まで探索する。
  const number = Math.abs(value);
  const limit = Math.floor(Math.sqrt(number));

  let count = 0;

//   入力された数を割り切るかを1から順に確認する。
  for (let divisor = 1; divisor <= limit; divisor += 1) {
    if (number % divisor !== 0) {
      continue;
    }

    // 割り切れた場合、ペアの約数を定義しておく。
    const pairedDivisor = number / divisor;

    // 平方根だった場合は1つカウントして、それ以外の場合ペアとまとめて計2つカウントする。
    if (divisor === pairedDivisor) {
      count += 1;
    } else {
      count += 2;
    }
  }

  return count;
}

// カード一枚を適用して、計算結果を返す関数。
export function applyCard(
  current: number,
  card: Card
): number {
  if (!Number.isFinite(current)) {
    throw new Error(
      "現在の数値が有限の数値ではありません。"
    );
  }

  if ("value" in card && !Number.isFinite(card.value)) {
    throw new Error(
      "カードの値が有限の数値ではありません。"
    );
  }

  let result: number;

// カードの種類によって処理を変える。
  switch (card.type) {
    case "plus":
      result = current + card.value;
      break;

    case "minus":
      result = current - card.value;
      break;

    case "multiply":
      result = current * card.value;
      break;

    case "divide":
      if (card.value === 0) {
        throw new Error("0で割ることはできません。");
      }

      result = current / card.value;
      break;

    case "mod":
      if (card.value === 0) {
        throw new Error("0による剰余は計算できません。");
      }

      result = current % card.value;
      break;

    case "backwards":
      result = reverseDigits(current);
      break;

    case "divisorCount":
      result = countDivisors(current);
      break;

    // エラー処理。
    default: {
      const unexpectedCard: never = card;

      throw new Error(
        `未対応のカードです: ${JSON.stringify(unexpectedCard)}`
      );
    }
  }

  if (!Number.isFinite(result)) {
    throw new Error(
      "計算結果が有限の数値ではありません。"
    );
  }

  return result;
}

// プレイヤーが決めた順序を反映したカードの配列orderedCardsに従い、初期値に演算を行う関数。
export function calculateResult(
  startNum: number,
  orderedCards: readonly Card[]
): number {
  if (!Number.isFinite(startNum)) {
    throw new Error(
      "初期値が有限の数値ではありません。"
    );
  }

  let current = startNum;

  for (const card of orderedCards) {
    current = applyCard(current, card);
  }

  return current;
}