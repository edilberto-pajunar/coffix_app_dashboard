"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LogOut,
  LayoutDashboard,
  Package,
  Store,
  Layers,
  Users,
  UserCheck,
  X,
  Menu,
} from "lucide-react";
import { signOut } from "firebase/auth";
import { auth } from "@/app/lib/firebase";
import { useState } from "react";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/dashboard/products", label: "Products", icon: Package },
  { href: "/dashboard/stores", label: "Stores", icon: Store },
  { href: "/dashboard/modifierGroups", label: "Modifier Groups", icon: Layers },
  { href: "/dashboard/users", label: "Users", icon: Users },
  { href: "/dashboard/staffs", label: "Staffs", icon: UserCheck },
];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();

  async function handleLogout() {
    await signOut(auth);
    router.push("/login");
  }

  return (
    <aside className="hidden md:flex w-56 shrink-0 flex-col border-r border-border bg-white">
      <div className="flex h-14 items-center border-b border-border px-4">
        <Link href="/dashboard" className="font-semibold text-primary">
          Coffix
        </Link>
      </div>
      <nav className="flex flex-col gap-0.5 p-3">
        {navItems.map(({ href, label, icon: Icon }) => {
          const isActive =
            href === "/dashboard"
              ? pathname === "/dashboard"
              : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              data-active={isActive}
              className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-black transition-colors hover:bg-soft-grey data-[active=true]:bg-primary data-[active=true]:text-white"
            >
              <Icon size={15} />
              {label}
            </Link>
          );
        })}
      </nav>
      <div className="mt-auto border-t border-border p-3">
        <button
          onClick={handleLogout}
          className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-black transition-colors hover:bg-soft-grey"
        >
          <LogOut size={15} />
          Logout
        </button>
      </div>
    </aside>
  );
}

export function FloatingNav() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();

  async function handleLogout() {
    await signOut(auth);
    router.push("/login");
  }

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-3 md:hidden">
      {open && (
        <>
          <div
            className="fixed inset-0 bg-black/20 backdrop-blur-sm"
            onClick={() => setOpen(false)}
          />
          <div className="relative z-10 flex flex-col items-end gap-2">
            {navItems.map(({ href, label, icon: Icon }) => {
              const isActive =
                href === "/dashboard"
                  ? pathname === "/dashboard"
                  : pathname.startsWith(href);
              return (
                <Link
                  key={href}
                  href={href}
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-3 rounded-2xl px-4 py-2.5 text-sm font-medium shadow-lg transition-all"
                  style={{
                    backgroundColor: isActive
                      ? "var(--color-primary, #6f4e37)"
                      : "white",
                    color: isActive ? "white" : "#1a1a1a",
                  }}
                >
                  <Icon size={16} />
                  {label}
                </Link>
              );
            })}
            <button
              onClick={handleLogout}
              className="flex items-center gap-3 rounded-2xl bg-white px-4 py-2.5 text-sm font-medium text-red-500 shadow-lg transition-all hover:bg-red-50"
            >
              <LogOut size={16} />
              Logout
            </button>
          </div>
        </>
      )}

      <button
        onClick={() => setOpen((v) => !v)}
        className="relative z-10 flex h-14 w-14 items-center justify-center rounded-full shadow-xl transition-all active:scale-95"
        style={{ backgroundColor: "var(--color-primary, #6f4e37)" }}
        aria-label="Navigation menu"
      >
        {open ? (
          <X size={22} className="text-white" />
        ) : (
          <Menu size={22} className="text-white" />
        )}
      </button>
    </div>
  );
}
