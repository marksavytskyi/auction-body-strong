import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import CaptureStatusBadge from "@/components/catalytic/CaptureStatusBadge";

describe("CaptureStatusBadge", () => {
    it("renders the Rejected label for a REJECTED status", () => {
        render(<CaptureStatusBadge status="REJECTED" />);
        expect(screen.getByText("Rejected")).toBeInTheDocument();
    });

    it("renders the Draft label for a DRAFT status", () => {
        render(<CaptureStatusBadge status="DRAFT" />);
        expect(screen.getByText("Draft")).toBeInTheDocument();
    });
});
