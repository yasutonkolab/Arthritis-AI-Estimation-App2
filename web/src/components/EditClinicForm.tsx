"use client";

import { useActionState } from "react";
import { updateClinic } from "@/app/actions/admin";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import { Card, CardContent } from "@/components/ui/Card";
import type { Clinic } from "@/lib/types";

export default function EditClinicForm({ clinic }: { clinic: Clinic }) {
  const [state, formAction, pending] = useActionState(updateClinic, {
    error: null,
    success: false,
  });

  return (
    <Card>
      <CardContent>
        <form action={formAction} className="space-y-4">
          <input type="hidden" name="clinic_id" value={clinic.id} />
          <Input
            id="name"
            name="name"
            label="医療機関名"
            defaultValue={clinic.name}
            maxLength={100}
            required
          />
          {state.error && (
            <p className="rounded-lg bg-danger p-3 text-sm text-danger-foreground">{state.error}</p>
          )}
          {state.success && (
            <p className="rounded-lg bg-success p-3 text-sm text-success-foreground">
              医療機関の情報を更新しました。
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
