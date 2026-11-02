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
});
