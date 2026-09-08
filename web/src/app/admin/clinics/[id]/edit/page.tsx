import { getClinic } from "@/app/actions/admin";
import EditClinicForm from "@/components/EditClinicForm";
import Button from "@/components/ui/Button";
import Link from "next/link";
import { notFound } from "next/navigation";

export default async function EditClinicPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const clinic = await getClinic(id);
  if (!clinic) notFound();

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">医療機関の情報を編集</h1>
          <p className="mt-1 text-sm text-muted-foreground">登録済みの医療機関名を変更します。</p>
        </div>
        <Link href={`/admin/clinics/${id}`}>
          <Button variant="secondary">詳細へ戻る</Button>
        </Link>
      </div>
      <EditClinicForm clinic={clinic} />
    </div>
  );
}
