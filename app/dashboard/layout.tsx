import { Sidebar } from "@/components/Sidebar";
import { requireUser } from "@/lib/server/dal";
import { levelFromXp } from "@/lib/scoring";
import { isAdmin } from "@/lib/server/services/admin";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const lv = levelFromXp(user.xp);
  const initials = user.name.split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase();
  return (
    <div className="md:flex">
      <Sidebar user={{ name: user.name, initials, level: lv.level, title: lv.title, isAdmin: isAdmin(user) }} />
      <main className="min-w-0 flex-1">{children}</main>
    </div>
  );
}
