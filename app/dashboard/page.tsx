"use client";

import { useDashboardStore } from "./products/store/useDashboardStore";

export default function DashboardPage() {
    const products = useDashboardStore((s) => s.products);
    const getCategoryName = useDashboardStore((s) => s.getCategoryName);
    const categoriesLoaded = useDashboardStore((s) => s.categoriesLoaded);

    const totalProducts = products.length;
    const avgPrice =
        totalProducts > 0
            ? products.reduce((sum, p) => sum + (p.price ?? 0), 0) / totalProducts
            : 0;

    const stats = [
        { label: "Total Products", value: totalProducts },
        { label: "Avg Price", value: `₱${avgPrice.toFixed(2)}` },
    ];

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-semibold text-black">Dashboard</h1>
                <p className="mt-1 text-sm text-light-grey">Overview of your coffee shop</p>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {stats.map(({ label, value }) => (
                    <div
                        key={label}
                        className="rounded-xl border border-border bg-white p-5 shadow-(--shadow)"
                    >
                        <p className="text-xs font-medium uppercase tracking-wide text-light-grey">
                            {label}
                        </p>
                        <p className="mt-2 text-3xl font-bold text-black">{value}</p>
                    </div>
                ))}
            </div>

            <div className="rounded-xl border border-border bg-white shadow-(--shadow)">
                <div className="border-b border-border px-5 py-4">
                    <h2 className="font-semibold text-black">Recent Products</h2>
                </div>
                <div className="divide-y divide-border">
                    {products.length === 0 ? (
                        <p className="px-5 py-8 text-center text-sm text-light-grey">
                            No products yet.
                        </p>
                    ) : (
                        products.slice(0, 5).map((product) => (
                            <div key={product.docId} className="flex items-center justify-between px-5 py-3">
                                <div>
                                    <p className="text-sm font-medium text-black">{product.name ?? "—"}</p>
                                    <p className="text-xs text-light-grey">{categoriesLoaded ? getCategoryName(product.categoryId) : "—"}</p>
                                </div>
                                <span className="text-sm font-semibold text-primary">
                                    ₱{(product.price ?? 0).toFixed(2)}
                                </span>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
}
