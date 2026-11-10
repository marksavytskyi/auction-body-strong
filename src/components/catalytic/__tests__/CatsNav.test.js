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
    // Phase K.51: exactly these eight, in this order, for owners and admins alike.
    const EIGHT = [
        ["Overview", "/cats/admin"],
        ["Lookup", "/cats"],
        ["Converters", "/cats/converters"],
        ["Observations", "/cats/observations"],
        ["Moderation", "/cats/moderation"],
        ["Sales", "/cats/sales"],
        ["CatDB Automation", "/cats/admin/catdb"],
        ["Users & Roles", "/cats/admin/users"],
    ];

    it.each(["OWNER", "ADMIN"])("gives %s exactly the eight items, each at its real route", (role) => {
        render(<CatsNav role={role} />);
        const links = screen.getAllByRole("link");
        expect(links.map((a) => [a.textContent.trim(), a.getAttribute("href")])).toEqual(EIGHT);
    });

    it.each(["Batch", "Copart Imports", "CatDB Batches", "Corrections", "Workers", "Catalog"])("no longer lists %s", (label) => {
        render(<CatsNav role="OWNER" />);
        expect(screen.queryByRole("link", { name: new RegExp(`^${label}$`, "i") })).toBeNull();
    });

    it("gives MODERATOR a narrower nav with no user administration or CatDB tools", () => {
        render(<CatsNav role="MODERATOR" />);

        expect(screen.getByRole("link", { name: /^moderation$/i })).toHaveAttribute("href", "/cats/moderation");
        expect(screen.getByRole("link", { name: /worker submissions/i })).toHaveAttribute("href", "/cats/moderation");
        expect(screen.queryByRole("link", { name: /users & roles/i })).not.toBeInTheDocument();
        expect(screen.queryByRole("link", { name: /^catdb$/i })).not.toBeInTheDocument();
    });

    it("renders nothing for a WORKER (the worker experience lives outside this nav)", () => {
        const { container } = render(<CatsNav role="WORKER" />);
        expect(container).toBeEmptyDOMElement();
    });
});
