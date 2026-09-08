"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import Button from "@/components/ui/Button";

interface CameraCaptureProps {
  /** 撮影完了時のコールバック（圧縮済みJPEGのBlob） */
  onCapture: (blob: Blob) => void;
  handLabel: string;
  instruction?: string;
  className?: string;
  disabled?: boolean;
}

const MAX_EDGE = 1280;
const JPEG_QUALITY = 0.8;

/** 画像を最大辺1280px・JPEG品質0.8に圧縮 */
async function compressImage(source: HTMLVideoElement): Promise<Blob> {
  const canvas = document.createElement("canvas");
  const scale = Math.min(
    1,
    MAX_EDGE / Math.max(source.videoWidth, source.videoHeight)
  );
  canvas.width = source.videoWidth * scale;
  canvas.height = source.videoHeight * scale;

  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(source, 0, 0, canvas.width, canvas.height);

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("画像の変換に失敗"))),
      "image/jpeg",
      JPEG_QUALITY
    );
  });
}

export default function CameraCapture({
  onCapture,
  handLabel,
  instruction,
  className = "",
  disabled = false,
}: CameraCaptureProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [flash, setFlash] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const flashTimerRef = useRef<number | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function startCamera() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment", width: { ideal: 1920 } },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          setReady(true);
        }
      } catch {
        setError("カメラにアクセスできません。設定からカメラのアクセスを許可してください。");
      }
    }

    startCamera();
    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
      if (flashTimerRef.current != null) window.clearTimeout(flashTimerRef.current);
    };
  }, []);

  const handleCapture = useCallback(async () => {
    if (!videoRef.current || capturing || disabled) return;
    setCapturing(true);
    setFlash(true);
    if (flashTimerRef.current != null) window.clearTimeout(flashTimerRef.current);
    flashTimerRef.current = window.setTimeout(() => setFlash(false), 140);
    try {
      const blob = await compressImage(videoRef.current);
      onCapture(blob);
    } catch {
      setError("撮影に失敗しました。もう一度お試しください。");
    } finally {
      setCapturing(false);
    }
  }, [onCapture, capturing, disabled]);

  // カメラ権限拒否時のフォールバックUI
  if (error) {
    return (
      <div className={`flex flex-col items-center gap-4 rounded-xl border border-danger-border bg-danger p-8 text-center ${className}`}>
        <p className="text-danger-foreground">{error}</p>
        <Button variant="secondary" onClick={() => window.location.reload()}>
          再試行
        </Button>
      </div>
    );
  }

  return (
    <div className={`relative min-h-[12rem] overflow-hidden rounded-xl bg-black ${className}`}>
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className="absolute inset-0 h-full w-full object-cover"
      />
      {/* 5:8 を保ちつつ、タブレットでは手のガイドとして過大にならないよう上限を設ける */}
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center px-4 pb-24 pt-14">
        <svg
          viewBox="0 0 80 128"
          className="h-[min(100%,32rem)] w-auto max-w-[min(100%,20rem)]"
          preserveAspectRatio="xMidYMid meet"
          aria-hidden="true"
        >
          <ellipse
            cx="40"
            cy="64"
            rx="36"
            ry="58"
            fill="none"
            stroke="white"
            strokeOpacity="0.8"
            strokeWidth="4"
            strokeDasharray="10 8"
            vectorEffect="non-scaling-stroke"
          />
        </svg>
      </div>
      {flash && (
        <div className="pointer-events-none absolute inset-0 z-10 bg-white/80" aria-hidden="true" />
      )}
      <div className="pointer-events-none absolute top-4 left-0 right-0 z-10 px-3 text-center">
        <span className="inline-block rounded-full bg-black/60 px-4 py-1.5 text-sm font-medium text-white">
          {instruction ??
            `${handLabel}をガイド枠に合わせてください（手首まで写してください）`}
        </span>
      </div>
      <div className="absolute bottom-[max(1rem,env(safe-area-inset-bottom))] left-0 right-0 z-10 flex justify-center">
        <button
          onClick={handleCapture}
          disabled={!ready || capturing || disabled}
          aria-label={`${handLabel}を撮影`}
          className="h-16 w-16 rounded-full border-4 border-white bg-white/30 transition hover:bg-white/50 disabled:opacity-40"
        />
      </div>
    </div>
  );
}
