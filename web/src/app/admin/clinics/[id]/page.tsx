import { getClinicDetail } from "@/app/actions/admin";
import StatusBadge from "@/components/StatusBadge";
import Button from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { formatJapanDate, formatJapanDateTime } from "@/lib/japan-date-time";
import Link from "next/link";
import { notFound } from "next/navigation";

export const metadata = { title: "医療機関の詳細 | 管理画面" };

export default async function ClinicDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const detail = await getClinicDetail(id);
  if (!detail) notFound();

  const { clinic, staffs, screenings } = detail;

  return (
    <div className="space-y-6">
      <div>
        <Link href="/admin/clinics" className="text-xs text-link hover:underline">
          ← 医療機関の一覧に戻る
        </Link>
        <div className="mt-2 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-foreground">{clinic.name}</h1>
            <div className="mt-1 space-y-0.5 text-xs text-muted-foreground">
              <p>
                ID: <span className="font-mono tracking-tight">{clinic.id}</span>
              </p>
              <p>登録日: {formatJapanDate(clinic.created_at)}</p>
            </div>
          </div>
          <Link href={`/admin/clinics/${clinic.id}/edit`}>
            <Button variant="secondary">編集</Button>
          </Link>
        </div>
      </div>

      <Card>
        <CardHeader className="flex flex-wrap items-center justify-between gap-3">
          <CardTitle>所属スタッフ ({staffs.length}件)</CardTitle>
          <Link href={`/admin/staffs/new?clinic_id=${clinic.id}`}>
            <Button size="sm" className="whitespace-nowrap">
              ＋ スタッフアカウント発行
            </Button>
          </Link>
        </CardHeader>
        <CardContent>
          {staffs.length === 0 ? (
            <p className="text-sm text-muted-foreground">所属スタッフはいません。</p>
          ) : (
            <ul className="divide-y divide-border">
              {staffs.map((staff) => (
                <li key={staff.id} className="flex items-center justify-between py-3">
                  <p className="font-semibold text-foreground">{staff.full_name}</p>
                  <div className="flex items-center gap-3">
                    <span
                      className={`inline-block rounded px-2 py-1 text-xs font-semibold ${
                        staff.is_active
                          ? "bg-success text-success-foreground"
                          : "bg-danger text-danger-foreground"
                      }`}
                    >
                      {staff.is_active ? "有効" : "無効"}
                    </span>
                    <Link href={`/admin/staffs/${staff.id}/edit`}>
                      <Button variant="secondary" size="sm">
                        編集
                      </Button>
                    </Link>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>撮影・解析データ ({screenings.length}件)</CardTitle>
        </CardHeader>
        <CardContent>
          {screenings.length === 0 ? (
            <p className="text-sm text-muted-foreground">撮影データはありません。</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-secondary-foreground">
                <thead className="border-b bg-surface-muted text-xs font-semibold uppercase text-secondary-foreground">
                  <tr>
                    <th className="px-4 py-3">被験者ID</th>
                    <th className="px-4 py-3">撮影日時</th>
                    <th className="px-4 py-3">担当スタッフ</th>
                    <th className="px-4 py-3">解析ステータス</th>
                    <th className="px-4 py-3">炎症数</th>
                    <th className="px-4 py-3">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {screenings.map((s) => (
                    <tr key={s.id} className="hover:bg-surface-hover">
                      <td className="px-4 py-3 font-mono text-xs tracking-tight">
                        {s.subject_id ?? "未割当"}
                      </td>
                      <td className="px-4 py-3 text-xs">
                        {formatJapanDateTime(s.created_at)}
                      </td>
                      <td className="px-4 py-3 text-xs">{s.staff_name ?? "不明"}</td>
                      <td className="px-4 py-3">
                        <StatusBadge status={s.status} />
                      </td>
                      <td className="px-4 py-3 text-xs">
                        {s.status === "completed" ? `${s.total_inflamed_joints ?? 0} 箇所` : "-"}
                      </td>
                      <td className="px-4 py-3">
                        <Link
                          href={`/admin/screenings/${s.id}`}
                          className="text-xs font-semibold text-link hover:underline"
                        >
                          結果を見る →
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
