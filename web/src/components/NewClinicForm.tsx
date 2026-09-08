"use client";

import { useActionState } from "react";
import { createClinic } from "@/app/actions/admin";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import { Card, CardContent } from "@/components/ui/Card";

export default function NewClinicForm() {
  const [state, formAction, pending] = useActionState(createClinic, {
    error: null,
    success: false,
  });

  return (
    <Card>
      <CardContent>
        <form action={formAction} className="flex flex-col gap-4">
          <Input
            id="name"
            name="name"
            label="医療機関名"
            placeholder="例: ○○整形外科クリニック"
            maxLength={100}
            required
          />
          {state.error && (
            <p className="rounded-lg bg-danger p-3 text-sm text-danger-foreground">{state.error}</p>
          )}
          {state.success && (
            <p className="rounded-lg bg-success p-3 text-sm text-success-foreground">
              医療機関を登録しました。
            </p>
          )}
          <Button type="submit" disabled={pending} className="w-full">
            {pending ? "登録中..." : "医療機関を新規登録する"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
