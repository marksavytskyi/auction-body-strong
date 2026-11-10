import { existsSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import nextConfig from "../../next.config.mjs";

// Phase K.51 — the removed CATS pages send old bookmarks somewhere useful, temporarily,
// and every destination is a page that exists.
const APP = path.resolve(__dirname, "../app");

describe("K.51 redirects", () => {
    it("send every removed page to its new home", async () => {
        const rules = Object.fromEntries((await nextConfig.redirects()).map((r) => [r.source, r]));
        expect(Object.fromEntries(Object.entries(rules).map(([k, r]) => [k, r.destination]))).toEqual({
            "/cats/batch": "/operations",
            "/cats/admin/copart": "/operations",
            "/cats/admin/copart/:id": "/operations",
            "/cats/admin/catdb-batches": "/cats/admin/catdb",
            "/cats/admin/catdb-batches/:id": "/cats/admin/catdb",
            "/cats/admin/corrections": "/cats/converters",
            "/cats/admin/workers": "/cats/admin/users",
            "/cats/admin/workers/:id": "/cats/admin/users?worker=:id",
            "/operations/settings/catdb": "/cats/admin/catdb?section=subscriptions",
        });
        for (const rule of Object.values(rules)) expect(rule.permanent).toBe(false);
    });

    it("the removed pages are gone and each destination exists", async () => {
        for (const gone of ["cats/batch", "cats/admin/copart", "cats/admin/catdb-batches", "cats/admin/corrections", "cats/admin/workers", "operations/settings/catdb"]) {
            expect(existsSync(path.join(APP, gone, "page.js"))).toBe(false);
        }
        for (const rule of await nextConfig.redirects()) {
            const target = rule.destination.split("?")[0].replace(/^\//, "");
            expect(existsSync(path.join(APP, target, "page.js"))).toBe(true);
        }
    });
});
