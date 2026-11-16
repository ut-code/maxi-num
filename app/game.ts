import type { BinaryCard, Card, StartNumbers, TernaryCard, UnaryCard } from "./stages";

// 演算結果型（成功 または エラー理由）
export type StepResult<T> =
  | { success: true; value: T }
  | { success: false; reason: string };

// 逆から読んだ数字を計算する関数。
export function reverseDigits(value: number): StepResult<number> {
  if (!Number.isSafeInteger(value)) {
    return {
      success: false,
      reason: "数字の反転には、安全に扱える範囲の整数が必要です。",
    };
  }

  // 絶対値を取ってから一度文字列に変換して、再び数字に戻す。
  const absoluteValue = Math.abs(value);
  const digits = String(absoluteValue);
  const reversedDigits = digits.split("").reverse().join("");
  const reversedValue = Number(reversedDigits);

  if (!Number.isSafeInteger(reversedValue)) {
    return {
      success: false,
      reason: "反転後の数値が、安全に扱える整数の範囲を超えました。",
    };
  }

  const result = value < 0 ? -reversedValue : reversedValue;
  return { success: true, value: result };
}

// 正の約数の個数を計算する関数。
export function countDivisors(value: number): StepResult<number> {
  if (!Number.isSafeInteger(value)) {
    return {
      success: false,
      reason: "約数の計算には、安全に扱える範囲の整数が必要です。",
    };
  }

  if (value === 0) {
    return {
      success: false,
      reason: "0の正の約数の個数は、有限の数として返せません。",
    };
  }

  // 絶対値の平方根まで探索する。
  const number = Math.abs(value);
  const limit = Math.floor(Math.sqrt(number));

  let count = 0;

  // 入力された数を割り切るかを1から順に確認する。
  for (let divisor = 1; divisor <= limit; divisor += 1) {
    if (number % divisor !== 0) {
      continue;
    }

    const pairedDivisor = number / divisor;

    if (divisor === pairedDivisor) {
      count += 1;
    } else {
      count += 2;
    }
  }

  return { success: true, value: count };
}

// 最大公約数 (GCD) を計算する内部ユーティリティ (事前チェック済み整数前提)。
function calculateGcd(a: number, b: number): number {
  let x = Math.abs(a);
  let y = Math.abs(b);

  while (y !== 0) {
    const temp = x % y;
    x = y;
    y = temp;
  }

  return x;
}

// 最大公約数 (GCD) を計算する関数。
export function gcd(a: number, b: number): StepResult<number> {
  if (!Number.isSafeInteger(a) || !Number.isSafeInteger(b)) {
    return {
      success: false,
      reason: "GCDの計算には、安全に扱える範囲の整数が必要です。",
    };
  }

  return { success: true, value: calculateGcd(a, b) };
}

// 3つの数の最大公約数 (GCD) を計算する関数。
export function gcd3(a: number, b: number, c: number): StepResult<number> {
  if (!Number.isSafeInteger(a) || !Number.isSafeInteger(b) || !Number.isSafeInteger(c)) {
    return {
      success: false,
      reason: "GCDの計算には、安全に扱える範囲の整数が必要です。",
    };
  }

  return { success: true, value: calculateGcd(calculateGcd(a, b), c) };
}

// 最小公倍数 (LCM) を計算する関数。
export function lcm(a: number, b: number): StepResult<number> {
  if (!Number.isSafeInteger(a) || !Number.isSafeInteger(b)) {
    return {
      success: false,
      reason: "LCMの計算には、安全に扱える範囲の整数が必要です。",
    };
  }

  if (a === 0 || b === 0) {
    return { success: true, value: 0 };
  }

  const g = calculateGcd(a, b);
  const result = Math.abs((a / g) * b);

  if (!Number.isSafeInteger(result)) {
    return {
      success: false,
      reason: "計算結果が安全に扱える整数の範囲を超えました。",
    };
  }

  return { success: true, value: result };
}

// 割る数と割られる数を入力して商(整数)と余りを返す関数。
export function divmod(
  dividend: number,
  divisor: number
): StepResult<[quotient: number, remainder: number]> {
  if (!Number.isSafeInteger(dividend) || !Number.isSafeInteger(divisor)) {
    return {
      success: false,
      reason: "商と余りの計算には、安全に扱える範囲の整数が必要です。",
    };
  }

  if (divisor === 0) {
    return {
      success: false,
      reason: "0で割ることはできません。",
    };
  }

  const quotient = Math.trunc(dividend / divisor);
  const remainder = dividend % divisor;

  return { success: true, value: [quotient, remainder] };
}

// 最大公約数と最小公倍数を返す関数。
export function gcdLcm(
  a: number,
  b: number
): StepResult<[gcd: number, lcm: number]> {
  const g = gcd(a, b);
  if (!g.success) {
    return g;
  }
  const l = lcm(a, b);
  if (!l.success) {
    return l;
  }
  return { success: true, value: [g.value, l.value] };
}

// 2つの数の比を取る関数。
export function ratio(
  a: number,
  b: number
): StepResult<[simplifiedA: number, simplifiedB: number]> {
  if (!Number.isSafeInteger(a) || !Number.isSafeInteger(b)) {
    return {
      success: false,
      reason: "比の計算には、安全に扱える範囲の整数が必要です。",
    };
  }

  if (a === 0 && b === 0) {
    return { success: true, value: [0, 0] };
  }

  const g = calculateGcd(a, b);
  return { success: true, value: [a / g, b / g] };
}

// 3つの数の比を取る関数。
export function ratio3(
  a: number,
  b: number,
  c: number
): StepResult<[simplifiedA: number, simplifiedB: number, simplifiedC: number]> {
  if (!Number.isSafeInteger(a) || !Number.isSafeInteger(b) || !Number.isSafeInteger(c)) {
    return {
      success: false,
      reason: "比の計算には、安全に扱える範囲の整数が必要です。",
    };
  }

  if (a === 0 && b === 0 && c === 0) {
    return { success: true, value: [0, 0, 0] };
  }

  const g = calculateGcd(calculateGcd(a, b), c);
  return { success: true, value: [a / g, b / g, c / g] };
}

// 順番だけ変えて小さい順に並べる関数。
export function sortAsc(a: number, b: number): StepResult<[number, number]>;
export function sortAsc(
  a: number,
  b: number,
  c: number
): StepResult<[number, number, number]>;
export function sortAsc(...numbers: number[]): StepResult<number[]> {
  for (const n of numbers) {
    if (!Number.isFinite(n)) {
      return {
        success: false,
        reason: "数値の比較には有限の数値が必要です。",
      };
    }
  }

  const sorted = [...numbers].sort((x, y) => x - y);
  return { success: true, value: sorted };
}

// 1入力1出力のカードを適用して、計算結果を返す関数。
export function applyUnaryCard(
  current: number,
  card: UnaryCard
): StepResult<number> {
  if (!Number.isFinite(current)) {
    return {
      success: false,
      reason: "現在の数値が有限の数値ではありません。",
    };
  }

  if ("value" in card && !Number.isFinite(card.value)) {
    return {
      success: false,
      reason: "カードの値が有限の数値ではありません。",
    };
  }

  let result: number;

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
        return {
          success: false,
          reason: "0で割ることはできません。",
        };
      }
      result = Math.trunc(current / card.value);
      break;

    case "mod":
      if (card.value === 0) {
        return {
          success: false,
          reason: "0による剰余は計算できません。",
        };
      }
      result = current % card.value;
      break;

    case "backwards":
      return reverseDigits(current);

    case "divisorCount":
      return countDivisors(current);
  }

  if (!Number.isFinite(result)) {
    return {
      success: false,
      reason: "計算結果が有限の数値ではありません。",
    };
  }

  return { success: true, value: result };
}

// 2入力2出力のカードを適用して、計算結果を返す関数。
export function applyBinaryCard(
  a: number,
  b: number,
  card: BinaryCard
): StepResult<[number, number]> {
  switch (card.type) {
    case "divmod":
      return divmod(a, b);

    case "gcdLcm":
      return gcdLcm(a, b);

    case "ratio":
      return ratio(a, b);

    case "sortAsc":
      return sortAsc(a, b);
  }
}

// 3入力3出力のカードを適用して、計算結果を返す関数。
export function applyTernaryCard(
  a: number,
  b: number,
  c: number,
  card: TernaryCard
): StepResult<[number, number, number]> {
  switch (card.type) {
    case "ratio3":
      return ratio3(a, b, c);
    case "sortAsc":
      return sortAsc(a, b, c);
  }
}

// 汎用カード適用関数 (入力配列の長さとカード種別に応じた演算を適用)
export function applyCard(
  inputs: readonly number[],
  card: Card,
  targetLane?: number
): StepResult<number[]> {
  if (isUnaryCard(card)) {
    if (inputs.length === 1) {
      const res = applyUnaryCard(inputs[0], card);
      if (!res.success) {
        return res;
      }
      return { success: true, value: [res.value] };
    }

    const lane = targetLane ?? 0;
    if (lane < 0 || lane >= inputs.length) {
      return {
        success: false,
        reason: `指定されたレーン ${lane} が範囲外です。`,
      };
    }

    const res = applyUnaryCard(inputs[lane], card);
    if (!res.success) {
      return res;
    }
    const next = [...inputs];
    next[lane] = res.value;
    return { success: true, value: next };
  }

  if (inputs.length === 2 && isBinaryCard(card)) {
    const res = applyBinaryCard(inputs[0], inputs[1], card);
    if (!res.success) {
      return res;
    }
    return { success: true, value: [...res.value] };
  }

  if (inputs.length === 3 && isTernaryCard(card)) {
    const res = applyTernaryCard(inputs[0], inputs[1], inputs[2], card);
    if (!res.success) {
      return res;
    }
    return { success: true, value: [...res.value] };
  }

  return {
    success: false,
    reason: `カード ${card.type} に対する入力の個数が不正です (入力: ${inputs.length}個)`,
  };
}

// カードの型ガード関数
export function isUnaryCard(card: Card): card is UnaryCard {
  return (
    card.type === "plus" ||
    card.type === "minus" ||
    card.type === "multiply" ||
    card.type === "divide" ||
    card.type === "mod" ||
    card.type === "backwards" ||
    card.type === "divisorCount"
  );
}

export function isBinaryCard(card: Card): card is BinaryCard {
  return (
    card.type === "divmod" ||
    card.type === "gcdLcm" ||
    card.type === "ratio" ||
    card.type === "sortAsc"
  );
}

export function isTernaryCard(card: Card): card is TernaryCard {
  return card.type === "ratio3" || card.type === "sortAsc";
}

// 配列で与えられた複数の数値の平均を計算する関数。
export function calculateAverageScore(
  numbers: readonly number[]
): StepResult<number> {
  if (numbers.length === 0) {
    return {
      success: false,
      reason: "数値が1つも存在しません。",
    };
  }

  for (const num of numbers) {
    if (!Number.isFinite(num)) {
      return {
        success: false,
        reason: "有限の数値ではありません。",
      };
    }
  }

  const sum = numbers.reduce((acc, curr) => acc + curr, 0);
  return { success: true, value: sum / numbers.length };
}

// 成功時の計算結果
export type CalculateSuccess = {
  success: true;
  finalNumbers: number[];
  score: number;
};

// 失敗時（擬似エラー画面表示用）のエラー情報
export type CalculateFailure = {
  success: false;
  error: {
    message: string;
    card?: Card;
    stepIndex?: number;
    inputs?: readonly number[];
  };
};

// 実行結果を表す型（成功 または 擬似エラー画面用情報）
export type ExecutionResult = CalculateSuccess | CalculateFailure;

export type CardStep =
  | Card
  | { card: Card; targetLane?: number };

// 初期値群に対して順序付けられたカード配列を順次適用し、最終数値配列と最終スコア(平均)、または疑似エラー画面用データを返す関数。
export function calculateResult(
  startNums: readonly number[],
  orderedCards: readonly CardStep[]
): ExecutionResult {
  if (startNums.length === 0 || startNums.length > 3) {
    return {
      success: false,
      error: {
        message: "初期値は1個から3個である必要があります。",
        inputs: startNums,
      },
    };
  }

  let current = [...startNums];

  for (let i = 0; i < orderedCards.length; i += 1) {
    const stepItem = orderedCards[i];
    const card = "type" in stepItem ? stepItem : stepItem.card;
    const targetLane = "targetLane" in stepItem ? stepItem.targetLane : undefined;
    const step = applyCard(current, card, targetLane);

    if (!step.success) {
      return {
        success: false,
        error: {
          message: step.reason,
          card,
          stepIndex: i,
          inputs: current,
        },
      };
    }

    current = step.value;
  }

  const avgResult = calculateAverageScore(current);
  if (!avgResult.success) {
    return {
      success: false,
      error: {
        message: avgResult.reason,
        inputs: current,
      },
    };
  }

  return {
    success: true,
    finalNumbers: current,
    score: avgResult.value,
  };
}