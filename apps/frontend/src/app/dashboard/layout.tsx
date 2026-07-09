import { auth } from "@/auth";
import { redirect } from "next/navigation";
import DashboardShell from "@/components/DashboardShell";

interface DashboardLayoutProps {
  children: React.ReactNode;
}

export default async function DashboardLayout({ children }: DashboardLayoutProps) {
  const session = await auth();

  if (!session || !session.user) {
    redirect("/auth/login");
  }

  return <DashboardShell user={session.user}>{children}</DashboardShell>;
}
