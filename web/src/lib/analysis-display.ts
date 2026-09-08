import { JOINT_LABELS, type JointName } from "./joints.ts";

export interface DisplayJoint {
  joint_name: string;
  is_inflamed: boolean;
  confidence_score?: number;
}

export interface HandSummary {
  side: "left" | "right";
  ra_detected: boolean;
  hand_probability: number;
  num_positive_joints: number;
  num_joints_detected: number;
  detailsOmitted: boolean;
  warnings: unknown[];
}

function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
function probability(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 1;
}
function count(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

/** 保存済みJSONを検査する。旧記録・欠損を陰性値で補完しない。 */
export function parseHandSummaries(value: unknown) {
  const hands: Partial<Record<"left" | "right", HandSummary>> = {};
  if (value == null || (Array.isArray(value) && value.length === 0)) {
    return { hands, invalid: false };
  }
  if (!Array.isArray(value)) return { hands, invalid: true };
  let invalid = value.length > 2;
  for (const item of value) {
    if (!record(item) || (item.side !== "left" && item.side !== "right")) {
      invalid = true;
      continue;
    }
    const side = item.side;
    if (value.filter((entry) => record(entry) && entry.side === side).length !== 1 ||
        typeof item.ra_detected !== "boolean" || !probability(item.hand_probability) ||
        !count(item.num_positive_joints) || !count(item.num_joints_detected) ||
        item.num_positive_joints > item.num_joints_detected ||
        !Array.isArray(item.joints) || !Array.isArray(item.warnings)) {
      invalid = true;
      continue;
    }
    hands[side] = {
      side, ra_detected: item.ra_detected, hand_probability: item.hand_probability,
      num_positive_joints: item.num_positive_joints, num_joints_detected: item.num_joints_detected,
      detailsOmitted: item.joints.length === 0, warnings: item.warnings,
    };
  }
  return { hands, invalid };
}

export function formatProbability(value: number | undefined | null) {
  return probability(value) ? `${(value * 100).toFixed(1)}%` : null;
}

export function describeJoint(name: JointName, joint: DisplayJoint | undefined, currentApi = false) {
  const missing = !joint;
  const inflamed = joint?.is_inflamed === true;
  const status = joint ? (inflamed ? "陽性" : "陰性")
    : currentApi && ["idxDIP", "midDIP", "ringDIP", "pinkyDIP"].includes(name)
      ? "解析対象外" : "結果なし";
  const confidence = joint ? formatProbability(joint.confidence_score) : null;
  const label = JOINT_LABELS[name];
  return { label, missing, inflamed, status, confidence,
    text: `${label}、${status}${confidence !== null ? `、陽性確率 ${confidence}` : ""}` };
}

export function describeWarning(value: unknown) {
  const original = typeof value === "string" ? value : JSON.stringify(value) ?? String(value);
  let explanation: string | null = null;
  if (original === "No hand detected in image.") explanation = "画像から手を検出できませんでした。";
  if (/^Joint \d+ \(.+\) crop out of frame; skipped\.$/.test(original)) {
    explanation = "画像の範囲外にある関節の解析が省略されました。";
  }
  if (original === "Dorsum reference patch unavailable (landmarks not detected); redness cue degraded.") {
    explanation = "手の甲の参照領域を取得できず、赤みの評価に制限があります。";
  }
  if (original.startsWith("Joints not detected/cropped: ")) {
    explanation = "検出または切り出しができなかった関節があります。";
  }
  return { original, explanation };
}
