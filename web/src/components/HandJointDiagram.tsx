"use client";

import { useState } from "react";
import { JOINT_LABELS, JOINT_NAMES, type JointName } from "@/lib/joints";

interface Joint {
  joint_name: string;
  is_inflamed: boolean;
  confidence_score?: number;
}

interface HandJointDiagramProps {
  joints: Joint[];
  /** 左手表示用の反転フラグ */
  mirror?: boolean;
  className?: string;
}

/** 各関節のSVG座標 (viewBox: 0 0 200 220) ※右手の甲を上から見た図 */
const JOINT_POSITIONS: Record<JointName, { x: number; y: number }> = {
  thumbIP: { x: 30, y: 62 },
  thumbMCP: { x: 48, y: 108 },
  idxDIP: { x: 78, y: 38 },
  idxPIP: { x: 82, y: 66 },
  idxMCP: { x: 86, y: 104 },
  midDIP: { x: 106, y: 28 },
  midPIP: { x: 108, y: 58 },
  midMCP: { x: 110, y: 100 },
  ringDIP: { x: 134, y: 36 },
  ringPIP: { x: 134, y: 66 },
  ringMCP: { x: 132, y: 104 },
  pinkyDIP: { x: 158, y: 62 },
  pinkyPIP: { x: 158, y: 86 },
  pinkyMCP: { x: 152, y: 116 },
  wrist: { x: 100, y: 180 },
};

/** 手の輪郭パス（右手、シンプルなシルエット） */
const HAND_OUTLINE =
  "M 55 200 L 55 130 Q 40 110 28 80 Q 24 68 30 62 Q 36 58 42 66 L 62 96 " +
  "L 66 50 Q 66 34 74 34 Q 82 34 82 48 L 84 92 " +
  "L 98 30 Q 100 18 108 18 Q 116 18 116 32 L 118 90 " +
  "L 130 40 Q 133 28 140 30 Q 147 32 146 44 L 142 94 " +
  "L 156 66 Q 161 56 167 60 Q 173 64 169 76 L 152 118 " +
  "Q 148 160 145 200 Z";

const SVG_WIDTH = 200;
const SVG_HEIGHT = 220;

function formatConfidence(score: number | undefined) {
  if (score == null) return null;
  return `${(score * 100).toFixed(0)}%`;
}

function describeJoint(name: JointName, joint: Joint | undefined) {
  const label = JOINT_LABELS[name];
  const inflamed = joint?.is_inflamed ?? false;
  const confidence = formatConfidence(joint?.confidence_score);
  const status = inflamed ? "炎症の疑いあり" : "炎症の疑いなし";
  return {
    label,
    inflamed,
    confidence,
    status,
    text: `${label}、${status}${confidence ? `、確度 ${confidence}` : ""}`,
  };
}

export default function HandJointDiagram({
  joints,
  mirror = false,
  className = "",
}: HandJointDiagramProps) {
  const [selectedName, setSelectedName] = useState<JointName | null>(null);
  const [hoveredName, setHoveredName] = useState<JointName | null>(null);
  const jointMap = new Map(joints.map((j) => [j.joint_name, j]));
  const inflamedCount = joints.filter((j) => j.is_inflamed).length;
  const selectedJoint = selectedName ? jointMap.get(selectedName) : undefined;
  const hoveredJoint = hoveredName ? jointMap.get(hoveredName) : undefined;
  const hoveredPos = hoveredName ? JOINT_POSITIONS[hoveredName] : null;
  const hoveredDesc = hoveredName ? describeJoint(hoveredName, hoveredJoint) : null;
  const handLabel = mirror ? "左手" : "右手";
  const tooltipXPercent = hoveredPos
    ? ((mirror ? SVG_WIDTH - hoveredPos.x : hoveredPos.x) / SVG_WIDTH) * 100
    : 0;
  const tooltipYPercent = hoveredPos ? (hoveredPos.y / SVG_HEIGHT) * 100 : 0;
  const tooltipBelow = tooltipYPercent < 22;
  const tooltipXAlign =
    tooltipXPercent < 28 ? "start" : tooltipXPercent > 72 ? "end" : "center";
  const tooltipXTranslate =
    tooltipXAlign === "start"
      ? "translate-x-0"
      : tooltipXAlign === "end"
        ? "-translate-x-full"
        : "-translate-x-1/2";

  function selectJoint(name: JointName) {
    setSelectedName((current) => (current === name ? null : name));
  }

  return (
    <div className={className}>
      <div className="relative">
        <svg
          viewBox={`0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`}
          className="w-full"
          role="group"
          aria-label={`${handLabel}の関節図。関節を選ぶと確度が表示されます`}
        >
          <g transform={mirror ? "translate(200 0) scale(-1 1)" : undefined}>
            <path
              d={HAND_OUTLINE}
              fill="var(--color-joint-hand)"
              stroke="var(--color-joint-outline)"
              strokeWidth="2"
              strokeLinejoin="round"
              pointerEvents="none"
            />
            {JOINT_NAMES.map((name) => {
              const pos = JOINT_POSITIONS[name];
              const joint = jointMap.get(name);
              const inflamed = joint?.is_inflamed ?? false;
              const isSelected = selectedName === name;
              const desc = describeJoint(name, joint);

              return (
                <g
                  key={name}
                  role="button"
                  tabIndex={0}
                  aria-pressed={isSelected}
                  aria-label={desc.text}
                  className="group cursor-pointer outline-none"
                  onClick={() => selectJoint(name)}
                  onMouseEnter={() => setHoveredName(name)}
                  onMouseLeave={() => setHoveredName(null)}
                  onFocus={() => setHoveredName(name)}
                  onBlur={() => setHoveredName(null)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      selectJoint(name);
                    }
                  }}
                >
                  {inflamed && (
                    <circle
                      cx={pos.x}
                      cy={pos.y}
                      r="9"
                      fill="var(--color-joint-inflamed)"
                      opacity="0.25"
                    />
                  )}
                  <circle
                    cx={pos.x}
                    cy={pos.y}
                    r="11"
                    fill="none"
                    stroke={isSelected ? "rgb(var(--color-primary))" : "transparent"}
                    strokeWidth="2"
                    className="group-focus-visible:stroke-primary"
                    pointerEvents="none"
                  />
                  <circle
                    cx={pos.x}
                    cy={pos.y}
                    r="5"
                    fill={
                      inflamed ? "var(--color-joint-inflamed)" : "var(--color-joint-marker)"
                    }
                    stroke={
                      inflamed
                        ? "var(--color-joint-inflamed-outline)"
                        : "var(--color-joint-outline)"
                    }
                    strokeWidth="1.5"
                    pointerEvents="none"
                  />
                  <circle cx={pos.x} cy={pos.y} r="12" fill="transparent" />
                </g>
              );
            })}
          </g>
          <text
            x="100"
            y="214"
            textAnchor="middle"
            fontSize="12"
            fill="var(--color-joint-label)"
          >
            {handLabel}
          </text>
        </svg>
        {hoveredName && hoveredDesc && (
          <div
            role="tooltip"
            aria-hidden="true"
            className={`pointer-events-none absolute z-10 w-max max-w-[11rem] rounded-md bg-tooltip px-2 py-1 text-center text-[11px] leading-snug text-tooltip-foreground shadow-lg ${tooltipXTranslate} ${
              tooltipBelow ? "translate-y-2" : "-translate-y-[calc(100%+0.5rem)]"
            }`}
            style={{ left: `${tooltipXPercent}%`, top: `${tooltipYPercent}%` }}
          >
            <p className="font-medium">{hoveredDesc.label}</p>
            <p className={hoveredDesc.inflamed ? "text-tooltip-danger" : "text-tooltip-muted"}>
              {hoveredDesc.status}
              {hoveredDesc.confidence ? `　確度 ${hoveredDesc.confidence}` : ""}
            </p>
          </div>
        )}
      </div>

      <div className="mt-1 min-h-[2.75rem] text-center" aria-live="polite">
        {selectedName ? (
          <>
            <p className="text-xs font-semibold text-foreground">{JOINT_LABELS[selectedName]}</p>
            <p
              className={`text-xs ${
                selectedJoint?.is_inflamed ? "font-medium text-danger-foreground" : "text-muted-foreground"
              }`}
            >
              {selectedJoint?.is_inflamed ? "炎症の疑いあり" : "炎症の疑いなし"}
              {selectedJoint?.confidence_score != null &&
                `　確度 ${formatConfidence(selectedJoint.confidence_score)}`}
            </p>
          </>
        ) : (
          <>
            <p className="text-xs text-muted-foreground">炎症の疑い: {inflamedCount}箇所</p>
            <p className="text-xs text-subtle-foreground">関節をタップすると確度が表示されます</p>
          </>
        )}
      </div>
    </div>
  );
}
