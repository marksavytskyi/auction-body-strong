import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import CatsNav from "../CatsNav";

vi.mock("next/navigation", () => ({
    usePathname: () => "/cats",
}));

// Guards the exact href every nav label points to -- the thing a worker/
// moderator/admin/owner actually clicks. If a route gets renamed without
// updating this list, this test catches it instead of production.
describe("CatsNav", () => {
    it("renders every OWNER-tier nav item pointing at its real, existing route", () => {
        render(<CatsNav role="OWNER" />);

        const expected = {
            Overview: "/cats/admin",
            Lookup: "/cats",
            Batch: "/cats/batch",
            Converters: "/cats/converters",
            Observations: "/cats/observations",
            Sales: "/cats/sales",
            Moderation: "/cats/moderation",
            Workers: "/cats/admin/workers",
            CatDB: "/cats/admin/catdb",
            "Copart Imports": "/cats/admin/copart",
            "CatDB Batches": "/cats/admin/catdb-batches",
            Corrections: "/cats/admin/corrections",
            "Users & Roles": "/cats/admin/users",
        };

        for (const [label, href] of Object.entries(expected)) {
            expect(screen.getByRole("link", { name: new RegExp(`^${label}$`, "i") })).toHaveAttribute("href", href);
        }
    });

    it("gives MODERATOR a narrower nav with no user administration or CatDB tools", () => {
        render(<CatsNav role="MODERATOR" />);

        expect(screen.getByRole("link", { name: /^moderation$/i })).toHaveAttribute("href", "/cats/moderation");
        expect(screen.getByRole("link", { name: /worker submissions/i })).toHaveAttribute("href", "/cats/admin/workers");
        expect(screen.queryByRole("link", { name: /users & roles/i })).not.toBeInTheDocument();
        expect(screen.queryByRole("link", { name: /^catdb$/i })).not.toBeInTheDocument();
    });

    it("renders nothing for a WORKER (the worker experience lives outside this nav)", () => {
        const { container } = render(<CatsNav role="WORKER" />);
        expect(container).toBeEmptyDOMElement();
    });
});
