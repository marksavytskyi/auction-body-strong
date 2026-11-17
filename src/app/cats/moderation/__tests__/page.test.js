import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import ModerationQueuePage from "../page";
import { listQueue } from "@/lib/catalytic/moderation";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("@/lib/catalytic/moderation", () => ({ listQueue: vi.fn() }));

describe("ModerationQueuePage", () => {
    it("asks for pending submissions only, and marks updated ones", async () => {
        listQueue.mockResolvedValue([
            { id: 1, status: "PENDING_REVIEW", revision: 2, year: 2017, make: "GMC", model: "Yukon", catalysts: [], submitted_by_user_id: 1 },
            { id: 2, status: "PENDING_REVIEW", revision: 1, year: 2018, make: "Ford", model: "F-150", catalysts: [], submitted_by_user_id: 1 },
        ]);
        render(<ModerationQueuePage />);
        expect(await screen.findByText("Updated · revision 2")).toBeInTheDocument();
        expect(screen.queryByText("Updated · revision 1")).not.toBeInTheDocument();
        expect(listQueue.mock.calls[0][0].status).toBe("PENDING_REVIEW");
    });

    it("shows the submitter's email instead of a bare user number", async () => {
        listQueue.mockResolvedValue([
            { id: 3, status: "PENDING_REVIEW", revision: 1, year: 2014, make: "Honda", model: "Accord", catalysts: [],
              submitted_by_user_id: 12, submitted_at: "2026-11-09T21:46:36",
              submitter: { user_id: 12, email: "test2@gmail.com", display_name: null, account_status: "ACTIVE" } },
        ]);
        render(<ModerationQueuePage />);
        const line = await screen.findByTestId("submitter-identity");
        expect(line).toHaveTextContent("Submitted by: test2@gmail.com");
        expect(line).toHaveTextContent("user #12");
        expect(screen.queryByText(/submitted by user #12/)).not.toBeInTheDocument();
    });
});
