"use client";

import { useActionState } from "react";
import { createStaff } from "@/app/actions/admin";
import Button from "@/components/ui/Button";
import GeneratedPasswordField from "@/components/GeneratedPasswordField";
import Input from "@/components/ui/Input";
import { Card, CardContent } from "@/components/ui/Card";
import type { Clinic } from "@/lib/types";

interface Props {
  clinics: Clinic[];
  defaultClinicId?: string;
  initialPassword: string;
}

export default function NewStaffForm({
  clinics,
  defaultClinicId,
  initialPassword,
}: Props) {
  const [state, formAction, pending] = useActionState(createStaff, {
    error: null,
    success: false,
  });

  return (
    <Card>
      <CardContent>
        <form action={formAction} autoComplete="off" className="flex flex-col gap-4">
          <div>
            <label htmlFor="clinic_id" className="block text-sm font-medium text-secondary-foreground mb-1">
              所属医療機関
            </label>
            <select
              id="clinic_id"
              name="clinic_id"
              required
              defaultValue={defaultClinicId ?? ""}
              className="w-full rounded-lg border border-border-strong bg-surface px-4 py-2.5 text-sm text-foreground focus:border-focus focus:outline-none focus:ring-1 focus:ring-focus"
            >
              <option value="">医療機関を選択してください...</option>
              {clinics.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <Input
            id="full_name"
            name="full_name"
            label="スタッフ氏名（表示用）"
            placeholder="例: 山田 太郎 医師"
            maxLength={100}
            required
          />

          <Input
            id="email"
            name="email"
            type="email"
            label="ログイン用メールアドレス"
            placeholder="staff@example.com"
            autoComplete="off"
            required
          />

          <GeneratedPasswordField
            id="password"
            label="初期パスワード（8文字以上）"
            initialPassword={initialPassword}
          />

          {state.error && (
            <p className="rounded-lg bg-danger p-3 text-sm text-danger-foreground">{state.error}</p>
          )}
          {state.success && (
            <p className="rounded-lg bg-success p-3 text-sm text-success-foreground">
              スタッフアカウントを発行しました。初期パスワードをスタッフへ共有してください。
            </p>
          )}

          <Button type="submit" disabled={pending} className="w-full">
            {pending ? "発行中..." : "スタッフアカウントを発行"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
