import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { replaceMock, pushMock } = vi.hoisted(() => {
    process.env.NEXT_PUBLIC_REGISTRATION_INVITE_CODE = "CODE1";
    return { replaceMock: vi.fn(), pushMock: vi.fn() };
});

vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: replaceMock, push: pushMock }) }));
vi.mock("@/utils/axios", () => ({ default: { get: vi.fn(), post: vi.fn() } }));
vi.mock("react-hot-toast", () => ({ default: { success: vi.fn(), error: vi.fn() } }));

import { resetRoleCache } from "@/hooks/useAuth";
import axiosInstance from "@/utils/axios";
import Page from "../page";

const token = () => `h.${Buffer.from(JSON.stringify({ sub: "a@b.co", exp: Math.floor(Date.now() / 1000) + 3600 })).toString("base64url")}.s`;

function submit() {
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "a@b.co" } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "secret1" } });
    fireEvent.change(screen.getByLabelText("Invite code"), { target: { value: "CODE1" } });
    fireEvent.click(screen.getByRole("button", { name: /create account/i }));
}

describe("register", () => {
    beforeEach(() => {
        resetRoleCache();
        vi.clearAllMocks();
        window.localStorage.clear();
        axiosInstance.post.mockResolvedValue({ data: { access_token: token() } });
    });

    it("sends a new WORKER to /worker, never /dashboard", async () => {
        axiosInstance.get.mockResolvedValue({ data: { role: "WORKER" } });
        render(<Page />);
        submit();
        await waitFor(() => expect(replaceMock).toHaveBeenCalledWith("/worker"));
        expect(replaceMock).not.toHaveBeenCalledWith("/dashboard");
    });

    it("sends a new account to /worker when its role can't be checked", async () => {
        axiosInstance.get.mockRejectedValue(new Error("Network Error"));
        render(<Page />);
        submit();
        await waitFor(() => expect(replaceMock).toHaveBeenCalledWith("/worker"));
    });

    it("sends an account the backend made a MODERATOR to /dashboard", async () => {
        axiosInstance.get.mockResolvedValue({ data: { role: "MODERATOR" } });
        render(<Page />);
        submit();
        await waitFor(() => expect(replaceMock).toHaveBeenCalledWith("/dashboard"));
    });

    it("never asks the backend for a role in the registration request", async () => {
        axiosInstance.get.mockResolvedValue({ data: { role: "WORKER" } });
        render(<Page />);
        submit();
        await waitFor(() => expect(axiosInstance.post).toHaveBeenCalled());
        expect(Object.keys(axiosInstance.post.mock.calls[0][1]).sort()).toEqual(["email", "invite_code", "password"]);
    });
});
