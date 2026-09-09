import { getCurrentUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import AdminNav from "@/components/AdminNav";
import UserAccountMenu from "@/components/UserAccountMenu";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const current = await getCurrentUser();
  if (!current) redirect("/login");
  if (current.profile.role !== "admin") redirect("/");

  return (
    <div className="min-h-dvh bg-background pb-safe">
      <header className="border-b border-border bg-surface pt-safe">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-6 gap-y-3 px-safe-6 py-3">
          <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
            <Link href="/admin" className="font-bold text-primary">
              関節炎スクリーニング管理
            </Link>
            <AdminNav />
          </div>
          <UserAccountMenu
            displayName={current.profile.full_name}
            passwordHref="/admin/account/password"
          />
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-safe-6 py-6">{children}</main>
    </div>
  );
}
