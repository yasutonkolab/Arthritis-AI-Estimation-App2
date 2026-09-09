import { getAdmin } from "@/app/actions/admin";
import EditAdminForm from "@/components/EditAdminForm";
import Button from "@/components/ui/Button";
import Link from "next/link";
import { notFound } from "next/navigation";

export default async function EditAdminPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const admin = await getAdmin(id);
  if (!admin) notFound();
  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-foreground">管理者の表示名を編集</h1>
        <Link href="/admin/admins"><Button variant="secondary">一覧へ戻る</Button></Link>
      </div>
      <p className="break-all text-xs text-muted-foreground">ID: {admin.id}</p>
      <EditAdminForm admin={admin} />
    </div>
  );
}
