import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

import OperationsLayout from "../layout";
import { useAuth } from "@/hooks/useAuth";

const routerReplace = vi.fn();
const routerPush = vi.fn();

vi.mock("next/navigation", () => ({
    useRouter: () => ({ replace: routerReplace, push: routerPush }),
}));

vi.mock("@/hooks/useAuth", () => ({
    useAuth: vi.fn(),
}));

vi.mock("@/components/shell/ModuleSwitcher", () => ({ default: () => <div data-testid="module-switcher" /> }));

function setAuth({ ready = true, isLoggedIn = true, email = "admin@example.com", role = "ADMIN", roleReady = true } = {}) {
    useAuth.mockReturnValue({ ready, isLoggedIn, email, role, roleReady });
}

const PROTECTED_CONTENT = "protected-operations-content";

describe("OperationsLayout — authorization gating (Phase H/I-B direct tests)", () => {
    const originalFlag = process.env.NEXT_PUBLIC_OPERATIONS_ENABLED;

    beforeEach(() => {
        vi.clearAllMocks();
    });

    afterEach(() => {
        process.env.NEXT_PUBLIC_OPERATIONS_ENABLED = originalFlag;
    });

    it("blocks everyone when the frontend feature flag is disabled, never rendering children, never redirecting", () => {
        process.env.NEXT_PUBLIC_OPERATIONS_ENABLED = "false";
        setAuth({ role: "OWNER" });
        render(<OperationsLayout><div>{PROTECTED_CONTENT}</div></OperationsLayout>);

        expect(screen.getByText(/operations is not enabled/i)).toBeInTheDocument();
        expect(screen.queryByText(PROTECTED_CONTENT)).not.toBeInTheDocument();
        expect(routerReplace).not.toHaveBeenCalled();
    });

    it("blocks everyone when the flag is simply unset (default-off)", () => {
        delete process.env.NEXT_PUBLIC_OPERATIONS_ENABLED;
        setAuth({ role: "OWNER" });
        render(<OperationsLayout><div>{PROTECTED_CONTENT}</div></OperationsLayout>);

        expect(screen.getByText(/operations is not enabled/i)).toBeInTheDocument();
        expect(screen.queryByText(PROTECTED_CONTENT)).not.toBeInTheDocument();
    });

    it("redirects an unauthenticated user to /login and never renders protected content", () => {
        process.env.NEXT_PUBLIC_OPERATIONS_ENABLED = "true";
        setAuth({ isLoggedIn: false, role: null, roleReady: false });
        render(<OperationsLayout><div>{PROTECTED_CONTENT}</div></OperationsLayout>);

        expect(routerReplace).toHaveBeenCalledWith("/login");
        expect(screen.queryByText(PROTECTED_CONTENT)).not.toBeInTheDocument();
    });

    it("grants an authenticated OWNER access to protected content", () => {
        process.env.NEXT_PUBLIC_OPERATIONS_ENABLED = "true";
        setAuth({ role: "OWNER" });
        render(<OperationsLayout><div>{PROTECTED_CONTENT}</div></OperationsLayout>);

        expect(screen.getByText(PROTECTED_CONTENT)).toBeInTheDocument();
        expect(routerReplace).not.toHaveBeenCalled();
    });

    it("grants an authenticated ADMIN access to protected content", () => {
        process.env.NEXT_PUBLIC_OPERATIONS_ENABLED = "true";
        setAuth({ role: "ADMIN" });
        render(<OperationsLayout><div>{PROTECTED_CONTENT}</div></OperationsLayout>);

        expect(screen.getByText(PROTECTED_CONTENT)).toBeInTheDocument();
        expect(routerReplace).not.toHaveBeenCalled();
    });

    it.each(["WORKER", "MODERATOR"])("denies a non-admin-tier role (%s), redirecting to /dashboard and never rendering protected content", (role) => {
        process.env.NEXT_PUBLIC_OPERATIONS_ENABLED = "true";
        setAuth({ role });
        render(<OperationsLayout><div>{PROTECTED_CONTENT}</div></OperationsLayout>);

        expect(routerReplace).toHaveBeenCalledWith("/dashboard");
        expect(screen.queryByText(PROTECTED_CONTENT)).not.toBeInTheDocument();
    });

    it("shows a loading state while auth/role are still resolving, never protected content and never a premature redirect", () => {
        process.env.NEXT_PUBLIC_OPERATIONS_ENABLED = "true";
        setAuth({ ready: false, roleReady: false });
        render(<OperationsLayout><div>{PROTECTED_CONTENT}</div></OperationsLayout>);

        expect(screen.getByText(/loading operations module/i)).toBeInTheDocument();
        expect(screen.queryByText(PROTECTED_CONTENT)).not.toBeInTheDocument();
        expect(routerReplace).not.toHaveBeenCalled();
    });

    it("shows a loading state when auth is ready but the role hasn't resolved yet, never flashing protected content", () => {
        process.env.NEXT_PUBLIC_OPERATIONS_ENABLED = "true";
        setAuth({ ready: true, isLoggedIn: true, role: null, roleReady: false });
        render(<OperationsLayout><div>{PROTECTED_CONTENT}</div></OperationsLayout>);

        expect(screen.getByText(/loading operations module/i)).toBeInTheDocument();
        expect(screen.queryByText(PROTECTED_CONTENT)).not.toBeInTheDocument();
    });

    it("never renders protected content for a single render pass unless fully authorized (no protected-content flash)", () => {
        process.env.NEXT_PUBLIC_OPERATIONS_ENABLED = "true";
        // Every unauthorized/pending combination in one sweep — none of
        // these may ever let the children slip through.
        const deniedStates = [
            { ready: false, isLoggedIn: false, role: null, roleReady: false },
            { ready: true, isLoggedIn: false, role: null, roleReady: false },
            { ready: true, isLoggedIn: true, role: null, roleReady: false },
            { ready: true, isLoggedIn: true, role: "WORKER", roleReady: true },
            { ready: true, isLoggedIn: true, role: "MODERATOR", roleReady: true },
        ];
        for (const state of deniedStates) {
            setAuth(state);
            const { unmount } = render(<OperationsLayout><div>{PROTECTED_CONTENT}</div></OperationsLayout>);
            expect(screen.queryByText(PROTECTED_CONTENT)).not.toBeInTheDocument();
            unmount();
        }
    });
});
