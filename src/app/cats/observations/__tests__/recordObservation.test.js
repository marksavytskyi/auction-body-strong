import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import ObservationsPage from "../page";
import { createObservation } from "@/lib/catalytic/api";

const nav = vi.hoisted(() => ({ params: new URLSearchParams() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: vi.fn(), push: vi.fn() }), useSearchParams: () => nav.params, usePathname: () => "/cats/observations" }));
vi.mock("@/hooks/useRoleGate", () => ({ useAdminTierGate: () => ({ ready: true }), useModeratorTierGate: () => ({ ready: true }) }));
vi.mock("@/components/catalytic/RecordObservationPanel", () => ({
    default: ({ initialPositionCode, initialCode }) => <div data-testid="record-panel">{`${initialPositionCode}|${initialCode}`}</div>,
}));
vi.mock("@/lib/catalytic/api", async () => {
    const actual = await vi.importActual("@/lib/catalytic/api");
    return { ...actual, listObservations: vi.fn().mockResolvedValue([]), createObservation: vi.fn() };
});

// Phase K.51 — Corrections' direct entry now lives in Observations, closed by default.
beforeEach(() => { nav.params = new URLSearchParams(); });

describe("Observations: Record Observation", () => {
    it("is closed until asked for, and opening it records nothing", async () => {
        render(<ObservationsPage />);
        expect(screen.queryByTestId("record-panel")).toBeNull();
        fireEvent.click(await screen.findByRole("button", { name: /Record Observation/ }));
        expect(screen.getByTestId("record-panel")).toBeInTheDocument();
        expect(createObservation).not.toHaveBeenCalled();
    });

    it("Lookup's link opens it with the position and code", async () => {
        nav.params = new URLSearchParams("record=1&position=P1&code=ABC123");
        render(<ObservationsPage />);
        expect(await screen.findByTestId("record-panel")).toHaveTextContent("P1|ABC123");
    });
});
