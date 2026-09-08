import HandJointDiagram from "@/components/HandJointDiagram";
import StatusBadge from "@/components/StatusBadge";
import { formatJapanDateTime } from "@/lib/japan-date-time";
import { JOINT_LABELS, type JointName } from "@/lib/joints";
import type { JointResult, Screening } from "@/lib/types";

interface ScreeningResultProps {
  screening: Screening;
  joints: JointResult[];
  images?: {
    right: string | null;
    left: string | null;
  };
  hideCapturedAt?: boolean;
}

/** AI判定結果の表示（患者側・医師側で共用） */
export default function ScreeningResult({
  screening,
  joints,
  images,
  hideCapturedAt = false,
}: ScreeningResultProps) {
  const rightJoints = joints.filter((j) => j.side === "right");
  const leftJoints = joints.filter((j) => j.side === "left");
  const rightInflamed = rightJoints.filter((j) => j.is_inflamed);
  const leftInflamed = leftJoints.filter((j) => j.is_inflamed);
  const inflamed = [...rightInflamed, ...leftInflamed];
  const totalPositiveJoints = screening.total_inflamed_joints ?? inflamed.length;
  const raDetected = screening.ra_detected ?? (inflamed.length > 0);
  const handImages = [
    { side: "left", label: "左手", url: images?.left },
    { side: "right", label: "右手", url: images?.right },
  ] as const;
  const hasImages = handImages.some(({ url }) => Boolean(url));

  return (
    <div className="space-y-6">
      {!hideCapturedAt && (
        <div className="flex items-center justify-between">
          <p className="text-[11px] text-muted-foreground">
            撮影日時: {formatJapanDateTime(screening.created_at)}
          </p>
          <StatusBadge status={screening.status} />
        </div>
      )}

      {hasImages && (
        <div className="rounded-xl border border-border bg-surface p-4">
          <h3 className="mb-3 text-sm font-semibold text-secondary-foreground">撮影画像</h3>
          <div className="grid grid-cols-2 gap-4">
            {handImages.map(({ side, label, url }) => (
              <div key={side} className="text-center">
                {url ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={url}
                    alt={`${label}画像`}
                    className="aspect-[3/4] w-full rounded-lg border border-border object-cover"
                  />
                ) : (
                  <div className="flex aspect-[3/4] items-center justify-center rounded-lg border border-dashed border-border bg-surface-muted text-xs text-subtle-foreground">
                    画像なし
                  </div>
                )}
                <p className="mt-1.5 text-xs font-medium text-secondary-foreground">{label}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {screening.status === "completed" && (
        <>
          <div
            className={`rounded-xl p-4 text-center font-bold ${
              raDetected
                ? "bg-danger text-danger-foreground"
                : "bg-success text-success-foreground"
            }`}
          >
            {raDetected
              ? `RAスクリーニング陽性（陽性関節 ${totalPositiveJoints} 箇所）`
              : "RAスクリーニング陰性"}
            <p className="mt-1 text-xs font-normal opacity-80">
              この判定はスクリーニング結果であり、診断結果ではありません。
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="rounded-xl border border-border bg-surface p-3">
              <HandJointDiagram joints={leftJoints} mirror className="w-full" />
            </div>
            <div className="rounded-xl border border-border bg-surface p-3">
              <HandJointDiagram joints={rightJoints} className="w-full" />
            </div>
          </div>

          {inflamed.length > 0 && (
            <div className="rounded-xl border border-border bg-surface">
              <p className="border-b border-border px-4 py-3 font-medium">検出された関節</p>
              <ul className="divide-y divide-border">
                {inflamed.map((j) => (
                  <li key={j.id} className="flex items-center justify-between px-4 py-2.5">
                    <span className="text-sm">
                      {j.side === "right" ? "右手" : "左手"}{" "}
                      {JOINT_LABELS[j.joint_name as JointName] ?? j.joint_name}
                    </span>
                    <span className="text-sm font-medium text-danger-foreground">
                      確度 {(j.confidence_score * 100).toFixed(0)}%
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </div>
  );
}
