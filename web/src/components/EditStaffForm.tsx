"use client";

import { useActionState } from "react";
import { updateStaff } from "@/app/actions/admin";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import { Card, CardContent } from "@/components/ui/Card";
import type { Clinic } from "@/lib/types";

interface EditableStaff {
  id: string;
  full_name: string;
  clinic_id: string | null;
  is_active: boolean;
}

interface Props {
  staff: EditableStaff;
  clinics: Clinic[];
}

export default function EditStaffForm({ staff, clinics }: Props) {
  const [state, formAction, pending] = useActionState(updateStaff, {
    error: null,
    success: false,
  });

  return (
    <Card>
      <CardContent>
        <form action={formAction} className="space-y-4">
          <input type="hidden" name="staff_id" value={staff.id} />
          <Input
            id="full_name"
            name="full_name"
            label="スタッフ氏名（表示用）"
            defaultValue={staff.full_name}
            maxLength={100}
            required
          />
          <div>
            <label htmlFor="clinic_id" className="mb-1 block text-sm font-medium text-secondary-foreground">
              所属医療機関
            </label>
            <select
              id="clinic_id"
              name="clinic_id"
              defaultValue={staff.clinic_id ?? ""}
              required
              className="w-full rounded-lg border border-border-strong bg-surface px-4 py-2.5 text-sm text-foreground focus:border-focus focus:outline-none focus:ring-1 focus:ring-focus"
            >
              <option value="">医療機関を選択してください...</option>
              {clinics.map((clinic) => (
                <option key={clinic.id} value={clinic.id}>
                  {clinic.name}
                </option>
              ))}
            </select>
          </div>
          <label className="flex items-center gap-2 text-sm text-secondary-foreground">
            <input
              type="checkbox"
              name="is_active"
              defaultChecked={staff.is_active}
              className="h-4 w-4 rounded border-border-strong bg-surface text-primary focus:ring-focus focus:ring-offset-surface"
            />
            このスタッフアカウントを有効にする
          </label>
          <p className="text-xs text-muted-foreground">
            無効にすると、スタッフはログインおよびデータアクセスができなくなります。
          </p>
          {state.error && (
            <p className="rounded-lg bg-danger p-3 text-sm text-danger-foreground">{state.error}</p>
          )}
          {state.success && (
            <p className="rounded-lg bg-success p-3 text-sm text-success-foreground">
              スタッフ情報を更新しました。
            </p>
          )}
          <Button type="submit" disabled={pending} className="w-full">
            {pending ? "更新中..." : "更新を保存"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
