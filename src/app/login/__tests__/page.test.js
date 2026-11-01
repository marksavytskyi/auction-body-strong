import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { resetRoleCache } from "@/hooks/useAuth";
import axiosInstance from "@/utils/axios";
import Page from "../page";

const replaceMock = vi.fn();

vi.mock("next/navigation", () => ({
    useRouter: () => ({ replace: replaceMock, push: vi.fn() }),
}));

vi.mock("@/utils/axios", () => ({
    default: { get: vi.fn(), post: vi.fn() },
}));

const token = () => `h.${Buffer.from(JSON.stringify({ sub: "a@b.co", exp: Math.floor(Date.now() / 1000) + 3600 })).toString("base64url")}.s`;

function fillAndSubmit(email, password) {
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: email } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: password } });
    fireEvent.click(screen.getByRole("button", { name: /sign in/i }));
}

describe("login", () => {
    beforeEach(() => {
        resetRoleCache();
        replaceMock.mockClear();
        axiosInstance.get.mockReset();
        axiosInstance.post.mockReset();
        window.localStorage.clear();
    });

    it("shows validation errors and sends nothing when the form is invalid", async () => {
        render(<Page />);
        fillAndSubmit("not-an-email", "123");
        expect(await screen.findByText("Invalid email address")).toBeInTheDocument();
        expect(screen.getByText("Password must be at least 6 characters")).toBeInTheDocument();
        expect(axiosInstance.post).not.toHaveBeenCalled();
    });

    it("signs in and opens the dashboard", async () => {
        axiosInstance.post.mockResolvedValue({ data: { access_token: token() } });
        axiosInstance.get.mockResolvedValue({ data: { role: "OWNER" } });
        render(<Page />);
        fillAndSubmit("a@b.co", "secret1");
        await waitFor(() => expect(replaceMock).toHaveBeenCalledWith("/dashboard"));
        expect(replaceMock).toHaveBeenCalledTimes(1);
        expect(window.localStorage.getItem("authToken")).toBeTruthy();
    });

    it("shows the server's message for bad credentials", async () => {
        axiosInstance.post.mockRejectedValue({ response: { status: 400, data: { detail: "Bad credentials" } } });
        render(<Page />);
        fillAndSubmit("a@b.co", "secret1");
        expect(await screen.findByText("Bad credentials")).toBeInTheDocument();
    });

    it("explains a network failure instead of hanging", async () => {
        axiosInstance.post.mockRejectedValue(new Error("Network Error"));
        render(<Page />);
        fillAndSubmit("a@b.co", "secret1");
        expect(await screen.findByText(/can't reach the server/i)).toBeInTheDocument();
    });

    it("sends an already signed-in user straight to their home", async () => {
        window.localStorage.setItem("authToken", token());
        axiosInstance.get.mockResolvedValue({ data: { role: "OWNER" } });
        render(<Page />);
        await waitFor(() => expect(replaceMock).toHaveBeenCalledWith("/dashboard"));
    });
});
