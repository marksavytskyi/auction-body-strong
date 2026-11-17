import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import SubmitterIdentity, { identityLabel } from "../SubmitterIdentity";

const fmt = () => "Nov 9, 2026";

describe("SubmitterIdentity", () => {
    it("shows the email, with the id as secondary information and the timestamp", () => {
        render(<SubmitterIdentity identity={{ user_id: 12, email: "test2@gmail.com", display_name: null, account_status: "ACTIVE" }} userId={12} submittedAt="2026-11-09T21:46:36" fmtDate={fmt} />);
        const line = screen.getByTestId("submitter-identity");
        expect(line).toHaveTextContent("Submitted by: test2@gmail.com");
        expect(line).toHaveTextContent("user #12");
        expect(line).toHaveTextContent("Nov 9, 2026");
        expect(line).not.toHaveTextContent("account");
    });

    it("shows the display name when there is one", () => {
        expect(identityLabel({ user_id: 3, email: "a@b.co", display_name: "Alex", account_status: "ACTIVE" }, 3)).toBe("Alex (a@b.co)");
    });

    it("keeps a deleted user's original email and says the account is deleted", () => {
        render(<SubmitterIdentity identity={{ user_id: 13, email: "gone@gmail.com", display_name: null, account_status: "DELETED" }} userId={13} />);
        expect(screen.getByTestId("submitter-identity")).toHaveTextContent("Submitted by: gone@gmail.com · user #13 · deleted account");
    });

    it("says an account is missing rather than inventing one", () => {
        render(<SubmitterIdentity identity={{ user_id: 99, email: null, display_name: null, account_status: "MISSING" }} userId={99} />);
        expect(screen.getByTestId("submitter-identity")).toHaveTextContent("Submitted by: user #99 · account not found");
    });

    it("falls back to the numeric id for non-administrators (no identity sent)", () => {
        render(<SubmitterIdentity identity={null} userId={12} />);
        expect(screen.getByTestId("submitter-identity")).toHaveTextContent("Submitted by: user #12");
        expect(screen.getByTestId("submitter-identity")).not.toHaveTextContent("@");
    });
});
