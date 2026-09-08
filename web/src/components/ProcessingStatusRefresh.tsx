"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { PROCESSING_REFRESH_INTERVAL_MS } from "@/lib/screening-staleness";

export default function ProcessingStatusRefresh() {
  const router = useRouter();

  useEffect(() => {
    const interval = window.setInterval(() => {
      router.refresh();
    }, PROCESSING_REFRESH_INTERVAL_MS);

    return () => window.clearInterval(interval);
  }, [router]);

  return null;
}
