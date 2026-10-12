import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi, beforeEach } from "vitest";

import NewCapturePage from "../page";
import { createCapture } from "@/lib/catalytic/workerCaptures";
import { CatalyticApiError } from "@/lib/catalytic/api";

const pushMock = vi.fn();

vi.mock("next/navigation", () => ({
    useRouter: () => ({ push: pushMock }),
}));

vi.mock("@/lib/catalytic/workerCaptures", () => ({
    createCapture: vi.fn(),
}));

vi.mock("react-hot-toast", () => ({
    default: { error: vi.fn(), success: vi.fn() },
}));

describe("NewCapturePage", () => {
    beforeEach(() => {
        pushMock.mockClear();
        createCapture.mockReset();
    });

    it("uppercases the VIN as the worker types", async () => {
        render(<NewCapturePage />);
        const vinInput = screen.getByPlaceholderText(/scan or type vin/i);
        fireEvent.change(vinInput, { target: { value: "1gnskckc8hr225261" } });
        expect(vinInput.value).toBe("1GNSKCKC8HR225261");
    });

    it("enables Continue once a full 17-char VIN is entered", async () => {
        render(<NewCapturePage />);
        const button = screen.getByRole("button", { name: /continue to catalysts/i });
        expect(button).toBeDisabled();

        const vinInput = screen.getByPlaceholderText(/scan or type vin/i);
        fireEvent.change(vinInput, { target: { value: "1GNSKCKC8HR225261" } });
        expect(button).not.toBeDisabled();
    });

    it("enables Continue with year+make+model even without a VIN", () => {
        render(<NewCapturePage />);
        const button = screen.getByRole("button", { name: /continue to catalysts/i });
        fireEvent.change(screen.getByPlaceholderText("2018"), { target: { value: "2017" } });
        fireEvent.change(screen.getByPlaceholderText("Ford"), { target: { value: "Chevrolet" } });
        fireEvent.change(screen.getByPlaceholderText("F-150"), { target: { value: "Tahoe" } });
        expect(button).not.toBeDisabled();
    });

    it("creates the capture and navigates to its detail page", async () => {
        createCapture.mockResolvedValue({ id: 42 });
        render(<NewCapturePage />);

        fireEvent.change(screen.getByPlaceholderText(/scan or type vin/i), { target: { value: "1GNSKCKC8HR225261" } });
        fireEvent.click(screen.getByRole("button", { name: /continue to catalysts/i }));

        await waitFor(() => expect(createCapture).toHaveBeenCalledWith(
            expect.objectContaining({ vin: "1GNSKCKC8HR225261" })
        ));
        await waitFor(() => expect(pushMock).toHaveBeenCalledWith("/worker/captures/42"));
    });

    it("keeps entered values on a network failure and allows retry", async () => {
        createCapture.mockRejectedValueOnce(new CatalyticApiError("Network error"));
        render(<NewCapturePage />);

        const vinInput = screen.getByPlaceholderText(/scan or type vin/i);
        fireEvent.change(vinInput, { target: { value: "1GNSKCKC8HR225261" } });
        fireEvent.click(screen.getByRole("button", { name: /continue to catalysts/i }));

        await waitFor(() => expect(createCapture).toHaveBeenCalledTimes(1));
        // Navigation never happened, and the VIN the worker typed is still there.
        expect(pushMock).not.toHaveBeenCalled();
        expect(vinInput.value).toBe("1GNSKCKC8HR225261");

        createCapture.mockResolvedValueOnce({ id: 7 });
        fireEvent.click(screen.getByRole("button", { name: /continue to catalysts/i }));
        await waitFor(() => expect(pushMock).toHaveBeenCalledWith("/worker/captures/7"));
    });
});
