import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { resetRoleCache } from "@/hooks/useAuth";
import { canUseMainApp, homeRouteForRole, isAdminTierRole } from "@/lib/rbac";
import axiosInstance from "@/utils/axios";
import RoleGuard from "../RoleGuard";

const replaceMock = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: replaceMock, push: vi.fn() }) }));
vi.mock("@/utils/axios", () => ({ default: { get: vi.fn() } }));

const token = () => `h.${Buffer.from(JSON.stringify({ sub: "a@b.co", exp: Math.floor(Date.now() / 1000) + 3600 })).toString("base64url")}.s`;

const Protected = vi.fn(() => <div>protected</div>);
const renderGuard = (allow = canUseMainApp) =>
    render(<RoleGuard allow={allow}><Protected /></RoleGuard>);

describe("RoleGuard", () => {
    beforeEach(() => {
        resetRoleCache();
        vi.clearAllMocks();
        axiosInstance.get.mockReset();
        window.localStorage.clear();
        window.localStorage.setItem("authToken", token());
    });

    it("sends a WORKER to /worker without ever rendering what it protects", async () => {
        axiosInstance.get.mockResolvedValue({ data: { role: "WORKER" } });
        renderGuard();
        await waitFor(() => expect(replaceMock).toHaveBeenCalledWith("/worker"));
        expect(Protected).not.toHaveBeenCalled();
    });

    it("gives an unrecognised role least privilege", async () => {
        axiosInstance.get.mockResolvedValue({ data: { role: "SOMETHING_NEW" } });
        renderGuard();
        await waitFor(() => expect(replaceMock).toHaveBeenCalledWith("/worker"));
        expect(Protected).not.toHaveBeenCalled();
    });

    it.each(["MODERATOR", "ADMIN", "OWNER"])("lets a %s into the main app", async (role) => {
        axiosInstance.get.mockResolvedValue({ data: { role } });
        renderGuard();
        expect(await screen.findByText("protected")).toBeInTheDocument();
        expect(replaceMock).not.toHaveBeenCalled();
    });

    it("sends a MODERATOR out of admin-only pages to /dashboard", async () => {
        axiosInstance.get.mockResolvedValue({ data: { role: "MODERATOR" } });
        renderGuard(isAdminTierRole);
        await waitFor(() => expect(replaceMock).toHaveBeenCalledWith("/dashboard"));
        expect(Protected).not.toHaveBeenCalled();
    });

    it("redirects an expired or missing session to /login", async () => {
        window.localStorage.clear();
        renderGuard();
        await waitFor(() => expect(replaceMock).toHaveBeenCalledWith("/login"));
        expect(axiosInstance.get).not.toHaveBeenCalled();
    });

    it("shows nothing protected while the role is unknown, then recovers on retry", async () => {
        axiosInstance.get.mockRejectedValueOnce(new Error("Network Error"));
        renderGuard();
        expect(await screen.findByText(/couldn't verify your account/i)).toBeInTheDocument();
        expect(Protected).not.toHaveBeenCalled();
        expect(replaceMock).not.toHaveBeenCalled();

        axiosInstance.get.mockResolvedValue({ data: { role: "ADMIN" } });
        fireEvent.click(screen.getByRole("button", { name: /try again/i }));
        expect(await screen.findByText("protected")).toBeInTheDocument();
    });

    it("keeps the role home routes the product expects", () => {
        expect(homeRouteForRole("worker")).toBe("/worker");
        expect(homeRouteForRole("MODERATOR")).toBe("/dashboard");
        expect(homeRouteForRole("ADMIN")).toBe("/dashboard");
        expect(homeRouteForRole("OWNER")).toBe("/dashboard");
    });
});
