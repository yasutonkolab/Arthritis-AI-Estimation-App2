import { getCurrentUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import ClinicStaffChrome from "@/components/ClinicStaffChrome";

export default async function ClinicStaffLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const current = await getCurrentUser();
  if (!current) redirect("/login");
  if (current.profile.role === "admin") redirect("/admin");

  return (
    <ClinicStaffChrome userName={current.profile.full_name}>{children}</ClinicStaffChrome>
  );
}
