"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { markInterruptedScreeningFailed } from "@/app/actions/analyze";
import Button from "@/components/ui/Button";

export default function RecoverInterruptedScreeningButton({
  screeningId,
}: {
  screeningId: string;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const recover = async () => {
    setLoading(true);
    setError(null);

    try {
      const result = await markInterruptedScreeningFailed(screeningId);
      if (result.error) {
        setError(result.error);
        return;
      }
      router.refresh();
    } catch {
      setError("中断状態の復旧に失敗しました。画面を更新して再度お試しください。");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-2">
      <Button type="button" onClick={recover} disabled={loading} className="w-full">
        {loading ? "復旧中..." : "中断状態を復旧する"}
      </Button>
      {error && <p className="text-sm text-danger-foreground">{error}</p>}
    </div>
  );
}
