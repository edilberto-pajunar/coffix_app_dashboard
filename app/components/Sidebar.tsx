"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { signOut } from "firebase/auth";
import { auth } from "@/app/lib/firebase";

const navItems = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/dashboard/products", label: "Products" },
  { href: "/dashboard/stores", label: "Stores" },
  { href: "/dashboard/modifierGroups", label: "Modifier Groups" },
  { href: "/dashboard/users", label: "Users" },


];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();

  async function handleLogout() {
    await signOut(auth);
    router.push("/login");
  }

  return (
    <aside className="flex w-56 shrink-0 flex-col border-r border-border bg-white">
      <div className="flex h-14 items-center border-b border-border px-4">
        <Link href="/dashboard" className="font-semibold text-primary">
          Coffix
        </Link>
      </div>
      <nav className="flex flex-col gap-0.5 p-3">
        {navItems.map(({ href, label }) => {
          const isActive =
            href === "/dashboard"
              ? pathname === "/dashboard"
              : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              data-active={isActive}
              className="rounded-lg px-3 py-2 text-sm text-black transition-colors hover:bg-soft-grey data-[active=true]:bg-primary data-[active=true]:text-white"
            >
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
