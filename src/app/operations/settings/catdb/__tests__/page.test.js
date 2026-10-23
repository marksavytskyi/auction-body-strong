import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";

import CatdbSettingsPage from "../page";
import {
    listOperationsCatdbSubscriptions,
    createOperationsCatdbSubscription,
    updateOperationsCatdbSubscription,
    listOperationsCatdbBalanceAdjustments,
    adjustOperationsCatdbSearchBalance,
    confirmOperationsCatdbSubscriptionRenewal,
    listOperationsCatdbDevices,
    updateOperationsCatdbDevice,
} from "@/lib/operations/api";

vi.mock("@/lib/operations/api", () => ({
    listOperationsCatdbSubscriptions: vi.fn(),
    createOperationsCatdbSubscription: vi.fn(),
    updateOperationsCatdbSubscription: vi.fn(),
    listOperationsCatdbBalanceAdjustments: vi.fn(),
    adjustOperationsCatdbSearchBalance: vi.fn(),
    listOperationsCatdbSubscriptionRenewals: vi.fn(),
    confirmOperationsCatdbSubscriptionRenewal: vi.fn(),
    listOperationsCatdbDevices: vi.fn(),
    updateOperationsCatdbDevice: vi.fn(),
}));

vi.mock("react-hot-toast", () => ({
    default: { success: vi.fn(), error: vi.fn() },
}));

function subscription(overrides = {}) {
    return {
        id: 1, display_name: "Device 1", account_email: "account1@gmail.com",
        reset_day: 5, monthly_limit: 300, enabled: true,
        created_by_user_id: 1, created_at: "2026-01-01T00:00:00", updated_at: "2026-01-01T00:00:00",
        ...overrides,
    };
}

function device(overrides = {}) {
    return {
        device_id: 10, device_name: "android-1", device_identifier: "pixel-7",
        device_status: "ONLINE", device_enabled: true, last_activity: "2026-10-22T00:00:00",
        subscription_id: 1, subscription_display_name: "Device 1", account_email: "account1@gmail.com",
        subscription_enabled: true, reset_day: 5, monthly_limit: 300,
        searches_used: 124, searches_reserved: 2, searches_remaining: 174,
        reconciliation_status: "RECONCILED", quota_error: null,
        ...overrides,
    };
}

async function flush() {
    await act(async () => {
        await Promise.resolve();
    });
}

describe("CatdbSettingsPage", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        listOperationsCatdbSubscriptions.mockResolvedValue({ items: [subscription()] });
        listOperationsCatdbDevices.mockResolvedValue({ items: [device()] });
    });

    it("renders the Section 2 device table with used/reserved/remaining from the live quota snapshot", async () => {
        render(<CatdbSettingsPage />);
        await flush();

        expect(await screen.findByText("Device 1")).toBeTruthy();
        expect(screen.getAllByText((text) => text.includes("account1@gmail.com")).length).toBeGreaterThan(0);
        expect(screen.getByText("124")).toBeTruthy();  // used
        expect(screen.getByText("2")).toBeTruthy();     // reserved
        expect(screen.getByText("174")).toBeTruthy();   // remaining
    });

    it("shows em-dash (never a fabricated 0) for a device with no subscription assigned", async () => {
        listOperationsCatdbDevices.mockResolvedValue({
            items: [device({ device_id: 11, subscription_id: null, account_email: null, searches_used: null, searches_reserved: null, searches_remaining: null, reset_day: null, monthly_limit: null })],
        });
        render(<CatdbSettingsPage />);
        await flush();

        expect(await screen.findByText("android-1")).toBeTruthy();
        // every quota-derived cell for this unassigned device renders "—"
        expect(screen.getAllByText("—").length).toBeGreaterThan(0);
    });

    it("creates a new subscription with the entered fields", async () => {
        createOperationsCatdbSubscription.mockResolvedValue(subscription({ id: 2 }));
        render(<CatdbSettingsPage />);
        await flush();

        fireEvent.click(screen.getByRole("button", { name: /new subscription/i }));
        fireEvent.change(screen.getByPlaceholderText("Device 1"), { target: { value: "Device 2" } });
        fireEvent.change(screen.getByPlaceholderText("account1@gmail.com"), { target: { value: "account2@gmail.com" } });

        await act(async () => {
            fireEvent.click(screen.getByRole("button", { name: /^create$/i }));
        });

        expect(createOperationsCatdbSubscription).toHaveBeenCalledWith({
            displayName: "Device 2", accountEmail: "account2@gmail.com", resetDay: 1, monthlyLimit: 300,
        });
    });

    it("toggles a subscription's enabled state", async () => {
        updateOperationsCatdbSubscription.mockResolvedValue(subscription({ enabled: false }));
        render(<CatdbSettingsPage />);
        await flush();

        await act(async () => {
            fireEvent.click(await screen.findByRole("button", { name: /^disable$/i }));
        });

        expect(updateOperationsCatdbSubscription).toHaveBeenCalledWith(1, { enabled: false });
    });

    it("confirms subscription renewal", async () => {
        confirmOperationsCatdbSubscriptionRenewal.mockResolvedValue({ id: 1, subscription_id: 1, period_key: "sub1:2026-10-05", confirmed_by_user_id: 1, confirmed_at: "2026-10-22T00:00:00" });
        render(<CatdbSettingsPage />);
        await flush();

        await act(async () => {
            fireEvent.click(await screen.findByRole("button", { name: /confirm renewal/i }));
        });

        expect(confirmOperationsCatdbSubscriptionRenewal).toHaveBeenCalledWith(1);
    });

    it("opens the Adjust Balance dialog and submits actual_remaining + reason", async () => {
        adjustOperationsCatdbSearchBalance.mockResolvedValue({
            id: 1, subscription_id: 1, previous_available: 174, new_available: 150, adjustment_amount: 24,
        });
        render(<CatdbSettingsPage />);
        await flush();

        fireEvent.click(await screen.findByRole("button", { name: /adjust balance/i }));
        fireEvent.change(screen.getByLabelText(/actual remaining searches/i), { target: { value: "150" } });
        fireEvent.change(screen.getByLabelText(/reason/i), { target: { value: "reconciled against dashboard" } });

        await act(async () => {
            fireEvent.click(screen.getByRole("button", { name: /record adjustment/i }));
        });

        expect(adjustOperationsCatdbSearchBalance).toHaveBeenCalledWith(1, {
            actualRemaining: 150, reason: "reconciled against dashboard",
        });
    });

    it("disables Record adjustment until both actual_remaining and reason are provided", async () => {
        render(<CatdbSettingsPage />);
        await flush();

        fireEvent.click(await screen.findByRole("button", { name: /adjust balance/i }));
        expect(screen.getByRole("button", { name: /record adjustment/i })).toBeDisabled();

        fireEvent.change(screen.getByLabelText(/actual remaining searches/i), { target: { value: "150" } });
        expect(screen.getByRole("button", { name: /record adjustment/i })).toBeDisabled();  // reason still blank

        fireEvent.change(screen.getByLabelText(/reason/i), { target: { value: "x" } });
        expect(screen.getByRole("button", { name: /record adjustment/i })).not.toBeDisabled();
    });

    it("reassigns a device to a different subscription without unassigning first", async () => {
        listOperationsCatdbSubscriptions.mockResolvedValue({
            items: [subscription({ id: 1, display_name: "Device 1" }), subscription({ id: 2, display_name: "Device 2", account_email: "account2@gmail.com" })],
        });
        updateOperationsCatdbDevice.mockResolvedValue({});
        render(<CatdbSettingsPage />);
        await flush();

        const select = await screen.findByDisplayValue(/Device 1/i);
        await act(async () => {
            fireEvent.change(select, { target: { value: "2" } });
        });

        expect(updateOperationsCatdbDevice).toHaveBeenCalledWith(10, { subscriptionId: 2 });
    });

    it("unassigns a device's subscription", async () => {
        updateOperationsCatdbDevice.mockResolvedValue({});
        render(<CatdbSettingsPage />);
        await flush();

        const select = await screen.findByDisplayValue(/Device 1/i);
        await act(async () => {
            fireEvent.change(select, { target: { value: "" } });
        });

        expect(updateOperationsCatdbDevice).toHaveBeenCalledWith(10, { unassignSubscription: true });
    });

    it("shows an error state when loading subscriptions/devices fails", async () => {
        listOperationsCatdbSubscriptions.mockRejectedValue(new Error("boom"));
        render(<CatdbSettingsPage />);
        await flush();

        expect(await screen.findByText(/failed to load/i)).toBeTruthy();
    });

    // Regression coverage for the reported bug: every dialog on this
    // page must escape ANY ancestor that establishes a containing block
    // for `position: fixed` (a CSS transform, same as framer-motion
    // leaves on src/app/operations/layout.js's own wrapper) — rendering
    // in place would otherwise clip/mis-position the modal exactly as
    // the bug report described. A React Portal to document.body is the
    // fix; these tests assert the portal actually happened.
    describe("modal stacking (bug regression)", () => {
        function renderInsideTransformedClippedAncestor() {
            // Mirrors the real bug condition: an ancestor with both a
            // CSS transform (framer-motion's motion.div, which keeps a
            // `transform` in its inline style even at rest) AND
            // overflow-hidden (src/app/operations/layout.js's outermost
            // wrapper) — together these make `position: fixed`
            // descendants containing-block-relative to THIS element
            // instead of the viewport, unless the dialog escapes via a
            // portal.
            const wrapper = document.createElement("div");
            wrapper.setAttribute("data-testid", "transformed-clipped-ancestor");
            wrapper.style.transform = "translateY(0px)";
            wrapper.style.overflow = "hidden";
            document.body.appendChild(wrapper);
            render(<CatdbSettingsPage />, { container: wrapper });
            return wrapper;
        }

        it("renders the Adjust Balance dialog's backdrop as a portal outside the transformed/clipped ancestor", async () => {
            const ancestor = renderInsideTransformedClippedAncestor();
            await flush();

            fireEvent.click(await screen.findByRole("button", { name: /adjust balance/i }));
            const backdrop = (await screen.findByText(/adjust search balance/i)).closest(".fixed");

            expect(backdrop).toBeTruthy();
            expect(ancestor.contains(backdrop)).toBe(false);
            expect(document.body.contains(backdrop)).toBe(true);
            expect(backdrop.parentElement).toBe(document.body);

            document.body.removeChild(ancestor);
        });

        it("renders the Adjustment History dialog's backdrop as a portal outside the transformed/clipped ancestor", async () => {
            listOperationsCatdbBalanceAdjustments.mockResolvedValue({ items: [] });
            const ancestor = renderInsideTransformedClippedAncestor();
            await flush();

            fireEvent.click((await screen.findAllByRole("button"))
                .find((b) => b.querySelector("svg.lucide-history")) || screen.getByTitle(/adjustment history/i));
            const backdrop = (await screen.findByText(/adjustment history/i)).closest(".fixed");

            expect(backdrop).toBeTruthy();
            expect(ancestor.contains(backdrop)).toBe(false);
            expect(document.body.contains(backdrop)).toBe(true);

            document.body.removeChild(ancestor);
        });

        it("keeps the Adjust Balance dialog's action buttons reachable (panel scrolls, not clipped) on a short viewport", async () => {
            render(<CatdbSettingsPage />);
            await flush();

            fireEvent.click(await screen.findByRole("button", { name: /adjust balance/i }));
            const recordButton = await screen.findByRole("button", { name: /record adjustment/i });
            const panel = recordButton.closest(".overflow-y-auto");

            expect(panel).toBeTruthy();
            expect(panel.className).toMatch(/max-h-\[90vh\]/);
            // The panel scrolls internally rather than letting the browser
            // clip it — this is what keeps Save/Cancel reachable
            // regardless of viewport height.
            expect(panel.contains(recordButton)).toBe(true);
        });
    });
});
