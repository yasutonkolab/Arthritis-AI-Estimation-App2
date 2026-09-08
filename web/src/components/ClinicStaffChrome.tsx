"use client";

import PatientBottomNav from "@/components/PatientBottomNav";
import UserAccountMenu from "@/components/UserAccountMenu";
import Link from "next/link";
import { usePathname } from "next/navigation";

export default function ClinicStaffChrome({
  userName,
  children,
}: {
  userName: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const isCapture = pathname.startsWith("/capture");

  return (
    <div
      className={
        isCapture
          ? "flex h-dvh flex-col overflow-hidden bg-background"
          : "min-h-dvh bg-background pb-nav-safe"
      }
    >
      <header
        className={`z-10 border-b border-border bg-surface pt-safe ${
          isCapture ? "shrink-0" : "sticky top-0"
        }`}
      >
        <div
          className={`mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-x-4 gap-y-2 px-safe-4 ${
            isCapture ? "py-2" : "py-3"
          }`}
        >
          <Link href="/" className="font-bold text-primary">
            関節炎スクリーニング（医療従事者用）
          </Link>
          <UserAccountMenu displayName={userName} passwordHref="/account/password" />
        </div>
      </header>
      <main
        className={
          isCapture
            ? "mx-auto flex min-h-0 w-full max-w-4xl flex-1 flex-col overflow-y-auto px-safe-4 py-3"
            : "mx-auto max-w-4xl px-safe-4 py-6"
        }
      >
        {children}
      </main>
      {!isCapture && <PatientBottomNav />}
    </div>
  );
}
