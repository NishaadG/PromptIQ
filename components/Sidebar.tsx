"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LayoutGrid, ListChecks, Cpu, Trophy, User, LogOut } from "lucide-react";
import { Logo } from "./Logo";
import { currentUser } from "@/lib/mock-data";
import { signOut } from "@/lib/session";

const items = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutGrid },
  { href: "/dashboard/tasks", label: "Tasks", icon: ListChecks },
  { href: "/dashboard/local-lab", label: "Local Lab", icon: Cpu },
  { href: "/dashboard/leaderboard", label: "Leaderboard", icon: Trophy },
  { href: "/dashboard/profile", label: "Profile", icon: User },
];

export function Sidebar() {
  const path = usePathname();
  const router = useRouter();
  const isActive = (href: string) =>
    href === "/dashboard" ? path === "/dashboard" : path.startsWith(href) || (href === "/dashboard/tasks" && path === "/dashboard/task");

  return (
    <>
      {/* Desktop */}
      <aside className="sticky top-0 hidden h-screen w-[232px] shrink-0 flex-col border-r border-line bg-paper md:flex">
        <div className="px-6 pt-6 pb-10"><Logo href="/dashboard" /></div>
        <nav className="flex-1 px-3">
          <p className="eyebrow px-3 pb-3">Workspace</p>
          {items.map(({ href, label, icon: Icon }) => {
            const active = isActive(href);
            return (
              <Link
                key={href}
                href={href}
                className={`group relative flex items-center gap-3 px-3 py-2.5 text-[0.9rem] transition-colors ${active ? "text-ink" : "text-ink-2 hover:text-ink"}`}
              >
                <span className={`absolute left-0 top-1/2 h-5 w-[2px] -translate-y-1/2 ${active ? "bg-rust" : "bg-transparent"}`} />
                <Icon size={16} strokeWidth={active ? 2 : 1.5} className={active ? "text-rust" : "text-mute group-hover:text-ink-2"} />
                <span className={active ? "font-medium" : ""}>{label}</span>
                {label === "Local Lab" && <span className="ml-auto font-mono text-[0.6rem] uppercase tracking-wider text-olive">New</span>}
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-line p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center bg-ink font-display text-sm italic text-paper">{currentUser.initials}</div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium">{currentUser.name}</div>
              <div className="text-[0.72rem] text-mute">Level {currentUser.level} · {currentUser.levelTitle}</div>
            </div>
            <button
              title="Sign out"
              onClick={() => { signOut(); router.push("/"); }}
              className="p-1.5 text-mute hover:text-rust"
            >
              <LogOut size={15} strokeWidth={1.5} />
            </button>
          </div>
        </div>
      </aside>

      {/* Mobile */}
      <div className="sticky top-0 z-20 border-b border-line bg-paper md:hidden">
        <div className="flex h-14 items-center justify-between px-5"><Logo href="/dashboard" /></div>
        <nav className="flex gap-5 overflow-x-auto px-5 pb-3 text-sm">
          {items.map(({ href, label }) => (
            <Link key={href} href={href} className={`whitespace-nowrap border-b-2 pb-1 ${isActive(href) ? "border-rust text-ink" : "border-transparent text-mute"}`}>{label}</Link>
          ))}
        </nav>
      </div>
    </>
  );
}
