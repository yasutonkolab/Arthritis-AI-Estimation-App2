"use client";

import { useActionState } from "react";
import { resetStaffPassword } from "@/app/actions/admin";
import GeneratedPasswordField from "@/components/GeneratedPasswordField";
import Button from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";

interface Props {
  staffId: string;
  initialPassword: string;
}

export default function ResetStaffPasswordForm({ staffId, initialPassword }: Props) {
  const [state, formAction, pending] = useActionState(resetStaffPassword, {
    error: null,
    success: false,
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>パスワードを再設定</CardTitle>
      </CardHeader>
      <CardContent>
        <form action={formAction} autoComplete="off" className="flex flex-col gap-4">
          <input type="hidden" name="staff_id" value={staffId} />
          <GeneratedPasswordField
            id="reset_password"
            label="新しいパスワード（8文字以上）"
            initialPassword={initialPassword}
            hint="再設定すると、スタッフは新しいパスワードでのみログインできます。共有前にコピーしてください。"
          />
          {state.error && (
            <p className="rounded-lg bg-danger p-3 text-sm text-danger-foreground">{state.error}</p>
          )}
          {state.success && (
            <p className="rounded-lg bg-success p-3 text-sm text-success-foreground">
              パスワードを再設定しました。新しいパスワードをスタッフへ共有してください。
            </p>
          )}
          <Button type="submit" disabled={pending} className="w-full">
            {pending ? "再設定中..." : "パスワードを再設定"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
