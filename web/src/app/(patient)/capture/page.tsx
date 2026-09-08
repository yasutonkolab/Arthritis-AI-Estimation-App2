import CaptureFlow from "@/components/CaptureFlow";

export const metadata = { title: "撮影 | 関節炎スクリーニング" };

export default function CapturePage() {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <CaptureFlow />
    </div>
  );
}
