import NewAdminForm from "@/components/NewAdminForm";

export default function NewAdminPage() {
  return (
    <div className="mx-auto max-w-lg space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">本部管理者アカウント発行</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          管理画面と全医療機関のデータを操作できる本部管理者を追加します。
        </p>
      </div>

      <NewAdminForm />
    </div>
  );
}
