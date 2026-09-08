import Link from "next/link";
import ChangePasswordForm from "@/components/ChangePasswordForm";

export default function ChangePasswordPage({ backHref }: { backHref: string }) {
  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div>
        <Link href={backHref} className="text-sm text-link hover:text-link-hover">
          ← 戻る
        </Link>
        <h1 className="mt-3 text-2xl font-bold text-foreground">パスワード変更</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          セキュリティ確認のため、現在のパスワードも入力してください。
        </p>
      </div>
      <ChangePasswordForm />
    </div>
  );
}
