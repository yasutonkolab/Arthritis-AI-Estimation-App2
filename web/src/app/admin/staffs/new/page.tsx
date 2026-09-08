import { getClinics } from "@/app/actions/admin";
import NewStaffForm from "@/components/NewStaffForm";
import { generatePassword } from "@/lib/generate-password";
import Link from "next/link";

export default async function NewStaffPage({
  searchParams,
}: {
  searchParams: Promise<{ clinic_id?: string }>;
}) {
  const { clinic_id: clinicId } = await searchParams;
  const clinics = await getClinics();
  const selectedClinic = clinicId
    ? clinics.find((clinic) => clinic.id === clinicId)
    : undefined;

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <div>
        {selectedClinic && (
          <Link
            href={`/admin/clinics/${selectedClinic.id}`}
            className="text-xs text-link hover:underline"
          >
            ← {selectedClinic.name}の詳細に戻る
          </Link>
        )}
        <h1 className={`${selectedClinic ? "mt-2 " : ""}text-2xl font-bold text-foreground`}>
          スタッフアカウント発行
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          契約先の医療機関の医療従事者（医師・看護師）用アカウントを発行します。
        </p>
      </div>

      <NewStaffForm
        clinics={clinics}
        defaultClinicId={selectedClinic?.id}
        initialPassword={generatePassword()}
      />
    </div>
  );
}
