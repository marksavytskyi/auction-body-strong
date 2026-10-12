import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import WorkerHomePage from "../page";
import { listCaptures } from "@/lib/catalytic/workerCaptures";

vi.mock("next/navigation", () => ({
    useRouter: () => ({ push: vi.fn() }),
}));

vi.mock("@/lib/catalytic/workerCaptures", async () => {
    const actual = await vi.importActual("@/lib/catalytic/workerCaptures");
    return { ...actual, listCaptures: vi.fn() };
});

function cap(overrides) {
    return { id: 1, status: "DRAFT", catalysts: [], updated_at: "2026-01-01T00:00:00Z", ...overrides };
}

describe("WorkerHomePage", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("groups captures by status, with REJECTED surfaced as Needs Action", async () => {
        listCaptures.mockResolvedValue([
            cap({ id: 1, status: "DRAFT", make: "Toyota", model: "Camry" }),
            cap({ id: 2, status: "REJECTED", make: "Ford", model: "F-150", moderator_notes: "blurry photo" }),
            cap({ id: 3, status: "PENDING_REVIEW", make: "Honda", model: "Civic" }),
            cap({ id: 4, status: "APPROVED", make: "Chevrolet", model: "Tahoe" }),
        ]);
        render(<WorkerHomePage />);

        await waitFor(() => expect(screen.getByText("Needs Action (1)")).toBeInTheDocument());
        expect(screen.getByText("Draft (1)")).toBeInTheDocument();
        expect(screen.getByText("Pending Review (1)")).toBeInTheDocument();
        expect(screen.getByText("Approved (1)")).toBeInTheDocument();
        expect(screen.getByText(/action required/i)).toBeInTheDocument();
    });

    it("never exposes another worker's captures — only renders what the API returned for this user", async () => {
        listCaptures.mockResolvedValue([cap({ id: 1, make: "Toyota", model: "Camry" })]);
        render(<WorkerHomePage />);

        await waitFor(() => expect(screen.getByText(/toyota camry/i)).toBeInTheDocument());
        // The backend is what actually scopes this (see /worker/captures)
        // — this just confirms the page renders exactly what it was given,
        // nothing merged in from elsewhere.
        expect(listCaptures).toHaveBeenCalledTimes(1);
    });

    it("shows an empty state with no network error when there are no captures yet", async () => {
        listCaptures.mockResolvedValue([]);
        render(<WorkerHomePage />);
        await waitFor(() => expect(screen.getByText(/no vehicles yet/i)).toBeInTheDocument());
    });
});
