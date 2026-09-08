"use client";

import { useActionState } from "react";
import { login } from "@/app/actions/auth";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import { Card, CardContent } from "@/components/ui/Card";

export default function LoginForm() {
  const [state, formAction, pending] = useActionState(login, { error: null });

  return (
    <Card>
      <CardContent>
        <form action={formAction} className="space-y-4">
          <Input
            id="email"
            name="email"
            type="email"
            label="メールアドレス"
            autoComplete="email"
            required
          />
          <Input
            id="password"
            name="password"
            type="password"
            label="パスワード"
            autoComplete="current-password"
            required
          />
          {state.error && (
            <p className="rounded-lg bg-danger p-3 text-sm text-danger-foreground">{state.error}</p>
          )}
          <Button type="submit" className="w-full" disabled={pending}>
            {pending ? "ログイン中..." : "ログイン"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
