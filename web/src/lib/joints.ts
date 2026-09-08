/** 手の15関節の定義 */
export const JOINT_NAMES = [
  "thumbIP",
  "thumbMCP",
  "idxDIP",
  "idxPIP",
  "idxMCP",
  "midDIP",
  "midPIP",
  "midMCP",
  "ringDIP",
  "ringPIP",
  "ringMCP",
  "pinkyDIP",
  "pinkyPIP",
  "pinkyMCP",
  "wrist",
] as const;

export type JointName = (typeof JOINT_NAMES)[number];

export const JOINT_LABELS: Record<JointName, string> = {
  thumbIP: "拇指IP",
  thumbMCP: "拇指MCP",
  idxDIP: "人差指DIP",
  idxPIP: "人差指PIP",
  idxMCP: "人差指MCP",
  midDIP: "中指DIP",
  midPIP: "中指PIP",
  midMCP: "中指MCP",
  ringDIP: "環指DIP",
  ringPIP: "環指PIP",
  ringMCP: "環指MCP",
  pinkyDIP: "小指DIP",
  pinkyPIP: "小指PIP",
  pinkyMCP: "小指MCP",
  wrist: "手関節",
};
