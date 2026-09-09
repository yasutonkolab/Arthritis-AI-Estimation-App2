"use client";

import { useActionState } from "react";
import { updateAdminName } from "@/app/actions/admin";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import { Card, CardContent } from "@/components/ui/Card";

export default function EditAdminForm({ admin }: { admin: { id: string; full_name: string } }) {
  const [state, formAction, pending] = useActionState(updateAdminName, { error: null, success: false });
  return (
    <Card>
      <CardContent>
        <form action={formAction} className="space-y-4">
          <input type="hidden" name="admin_id" value={admin.id} />
          <Input id="full_name" name="full_name" label="管理者氏名（表示用）" defaultValue={admin.full_name} maxLength={100} required />
          {state.error && <p role="alert" className="rounded-lg bg-danger p-3 text-sm text-danger-foreground">{state.error}</p>}
          {state.success && <p role="status" className="rounded-lg bg-success p-3 text-sm text-success-foreground">管理者の表示名を更新しました。</p>}
          <Button type="submit" disabled={pending} className="w-full">{pending ? "更新中..." : "更新を保存"}</Button>
        </form>
      </CardContent>
    </Card>
  );
}
