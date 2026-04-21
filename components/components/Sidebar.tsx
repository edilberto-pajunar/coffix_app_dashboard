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
  Settings,
  Bell,
  Mail,
  ArrowLeftRight,
  Tag,
  Share,
} from "lucide-react";
import { signOut } from "firebase/auth";
import { auth } from "@/app/lib/firebase";
import { useAuth } from "@/app/lib/AuthContext";
import { WEBAPP_VERSION } from "@/app/utils/constant";
import { useState } from "react";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, adminOnly: true },
  { href: "/dashboard/products", label: "Products", icon: Package, adminOnly: false },
  { href: "/dashboard/categories", label: "Categories", icon: Layers, adminOnly: true },
  { href: "/dashboard/stores", label: "Stores", icon: Store, adminOnly: false },
  { href: "/dashboard/modifierGroups", label: "Modifier Groups", icon: Layers, adminOnly: true },
  { href: "/dashboard/users", label: "Customers", icon: Users, adminOnly: true },
  { href: "/dashboard/transactions", label: "Transactions", icon: ArrowLeftRight, adminOnly: true },
  { href: "/dashboard/staffs", label: "Users", icon: UserCheck, adminOnly: true },
  // { href: "/dashboard/notifications", label: "Campaigns", icon: Bell, adminOnly: true },
  { href: "/dashboard/globalSettings", label: "Global Settings", icon: Settings, adminOnly: true },
  { href: "/dashboard/emailTemplates", label: "Email Templates", icon: Mail, adminOnly: true },
  { href: "/dashboard/referrals", label: "Referrals", icon: Share, adminOnly: true },
  { href: "/dashboard/coupons", label: "Coupons", icon: Tag, adminOnly: true },
];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, currentStaff } = useAuth();
  const isAdmin = currentStaff?.role === "admin";
  const visibleItems = navItems.filter((item) => !item.adminOnly || isAdmin);

  async function handleLogout() {
    await signOut(auth);
    router.push("/login");
  }

  return (
    <aside className="hidden md:flex w-56 shrink-0 flex-col border-r border-border bg-white">
      <div className="flex h-14 items-center border-b border-border px-4">
        <Link href="/dashboard" className="font-semibold text-primary">
        Coffix App Manager
        </Link>
      </div>
      <nav className="flex flex-col gap-0.5 p-3">
        {visibleItems.map(({ href, label, icon: Icon }) => {
          const isActive =
            href === "/dashboard"
              ? pathname === "/dashboard"
              : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              data-active={isActive}
              className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-black transition-colors hover:bg-soft-grey hover:text-white data-[active=true]:bg-primary data-[active=true]:text-white"
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
          className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-black transition-colors hover:bg-soft-grey hover:text-white"
        >
          <LogOut size={15} />
          Logout
        </button>
        {user?.email && (
          <p className="mb-1 px-3 text-xs  truncate">{user.email}</p>
        )}
        <p className="mt-2 px-3 text-xs">v{WEBAPP_VERSION}</p>
      </div>
    </aside>
  );
}

export function MobileNav() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const { user, currentStaff } = useAuth();
  const isAdmin = currentStaff?.role === "admin";
  const visibleItems = navItems.filter((item) => !item.adminOnly || isAdmin);

  async function handleLogout() {
    await signOut(auth);
    router.push("/login");
  }

  return (
    <>
      {/* FAB trigger */}
      <button
        onClick={() => setOpen(true)}
        className="fixed top-4 left-4 z-40 flex h-10 w-10 items-center justify-center rounded-full shadow-xl transition-all active:scale-95 md:hidden"
        style={{ backgroundColor: "var(--color-primary, #6f4e37)" }}
        aria-label="Open navigation"
      >
        <Menu size={22} className="text-white" />
      </button>

      {/* Backdrop */}
      {open && (
        <div
          className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm md:hidden"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Drawer */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-64 flex-col bg-white shadow-2xl transition-transform duration-300 ease-in-out md:hidden ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex h-14 items-center justify-between border-b border-border px-4">
          <Link
            href="/dashboard"
            onClick={() => setOpen(false)}
            className="font-semibold text-primary"
          >
            Coffix App Manager
          </Link>
          <button
            onClick={() => setOpen(false)}
            className="rounded-lg p-1.5 text-black transition-colors hover:bg-soft-grey hover:text-white"
            aria-label="Close navigation"
          >
            <X size={18} />
          </button>
        </div>

        <nav className="flex flex-col gap-0.5 p-3">
          {visibleItems.map(({ href, label, icon: Icon }) => {
            const isActive =
              href === "/dashboard"
                ? pathname === "/dashboard"
                : pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                onClick={() => setOpen(false)}
                data-active={isActive}
                className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-black transition-colors hover:bg-soft-grey hover:text-white data-[active=true]:bg-primary data-[active=true]:text-white"
              >
                <Icon size={15} />
                {label}
              </Link>
            );
          })}
        </nav>

        <div className="mt-auto border-t border-border p-3">
          {user?.email && (
            <p className="mb-1 px-3 text-xs text-gray-500 truncate">{user.email}</p>
          )}
          <button
            onClick={handleLogout}
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-red-500 transition-colors hover:bg-red-50"
          >
            <LogOut size={15} />
            Logout
          </button>
        </div>
      </aside>
    </>
  );
}
