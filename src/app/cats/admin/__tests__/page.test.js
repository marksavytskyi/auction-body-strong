import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { getStats } from "@/lib/catalytic/catdbAdmin";
import Page from "../page";

vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: vi.fn(), push: vi.fn() }), usePathname: () => "/cats/admin" }));
vi.mock("@/hooks/useRoleGate", () => ({ useAdminTierGate: () => ({ ready: true }) }));
vi.mock("@/lib/catalytic/catdbAdmin", async (original) => ({
    ...(await original()),
    getStats: vi.fn().mockResolvedValue({
        failed_today: 2,
        recent_errors: [{ vin: "1HGCM66526A000000", error_message: "worker failed" }],
    }),
    listMachines: vi.fn().mockResolvedValue([]),
}));
vi.mock("@/lib/catalytic/moderation", async (original) => ({ ...(await original()), listQueue: vi.fn().mockResolvedValue([]) }));
vi.mock("@/lib/catalytic/users", async (original) => ({ ...(await original()), listUsers: vi.fn().mockResolvedValue([]) }));
vi.mock("@/lib/catalytic/api", async (original) => ({ ...(await original()), listSales: vi.fn().mockResolvedValue([]) }));

describe("Cats Overview", () => {
    it("doesn't show recent CatDB errors, even when the API returns them", async () => {
        render(<Page />);
        await waitFor(() => expect(getStats).toHaveBeenCalled());
        await screen.findByText(/failed today/i);
        expect(screen.queryByText(/recent catdb errors/i)).not.toBeInTheDocument();
        expect(screen.queryByText("1HGCM66526A000000")).not.toBeInTheDocument();
    });
});
