import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

import ModuleSwitcher from "../ModuleSwitcher";
import { useAuth } from "@/hooks/useAuth";

vi.mock("next/navigation", () => ({
    useRouter: () => ({ push: vi.fn() }),
}));

vi.mock("@/hooks/useAuth", () => ({
    useAuth: vi.fn(),
}));

function setAuth({ isLoggedIn = true, roleReady = true, role = "ADMIN" } = {}) {
    useAuth.mockReturnValue({ isLoggedIn, roleReady, role });
}

describe("ModuleSwitcher — Operations entry gating", () => {
    const originalFlag = process.env.NEXT_PUBLIC_OPERATIONS_ENABLED;

    afterEach(() => {
        process.env.NEXT_PUBLIC_OPERATIONS_ENABLED = originalFlag;
    });

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("hides Operations when the frontend feature flag is disabled, even for an OWNER", () => {
        process.env.NEXT_PUBLIC_OPERATIONS_ENABLED = "false";
        setAuth({ role: "OWNER" });
        render(<ModuleSwitcher active="cats" />);
        expect(screen.queryByRole("tab", { name: /operations/i })).not.toBeInTheDocument();
    });

    it("hides Operations when the flag is simply unset (default-off)", () => {
        delete process.env.NEXT_PUBLIC_OPERATIONS_ENABLED;
        setAuth({ role: "OWNER" });
        render(<ModuleSwitcher active="cats" />);
        expect(screen.queryByRole("tab", { name: /operations/i })).not.toBeInTheDocument();
    });

    it("shows Operations for an authenticated OWNER when the flag is enabled", () => {
        process.env.NEXT_PUBLIC_OPERATIONS_ENABLED = "true";
        setAuth({ role: "OWNER" });
        render(<ModuleSwitcher active="cats" />);
        expect(screen.getByRole("tab", { name: /operations/i })).toBeInTheDocument();
    });

    it("shows Operations for an authenticated ADMIN when the flag is enabled", () => {
        process.env.NEXT_PUBLIC_OPERATIONS_ENABLED = "true";
        setAuth({ role: "ADMIN" });
        render(<ModuleSwitcher active="cats" />);
        expect(screen.getByRole("tab", { name: /operations/i })).toBeInTheDocument();
    });

    it("hides Operations for a WORKER even when the flag is enabled", () => {
        process.env.NEXT_PUBLIC_OPERATIONS_ENABLED = "true";
        setAuth({ role: "WORKER" });
        render(<ModuleSwitcher active="parts" />);
        expect(screen.queryByRole("tab", { name: /operations/i })).not.toBeInTheDocument();
    });

    it("hides Operations for an unauthenticated visitor even when the flag is enabled", () => {
        process.env.NEXT_PUBLIC_OPERATIONS_ENABLED = "true";
        setAuth({ isLoggedIn: false, role: null });
        render(<ModuleSwitcher active="parts" />);
        expect(screen.queryByRole("tab", { name: /operations/i })).not.toBeInTheDocument();
    });

    it("hides Operations while role is still resolving, preventing a flash of the nav item", () => {
        process.env.NEXT_PUBLIC_OPERATIONS_ENABLED = "true";
        setAuth({ roleReady: false, role: null });
        render(<ModuleSwitcher active="parts" />);
        expect(screen.queryByRole("tab", { name: /operations/i })).not.toBeInTheDocument();
    });

    it("always shows the pre-existing Parts and Cats modules regardless of flag/role", () => {
        process.env.NEXT_PUBLIC_OPERATIONS_ENABLED = "false";
        setAuth({ role: "WORKER" });
        render(<ModuleSwitcher active="parts" />);
        expect(screen.getByRole("tab", { name: /parts/i })).toBeInTheDocument();
        expect(screen.getByRole("tab", { name: /cats/i })).toBeInTheDocument();
    });
});
