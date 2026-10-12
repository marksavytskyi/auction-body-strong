import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useAuth } from "@/hooks/useAuth";
import { useAdminTierGate, useOwnerOnlyGate } from "@/hooks/useRoleGate";
import axiosInstance from "@/utils/axios";

const replaceMock = vi.fn();

vi.mock("next/navigation", () => ({
    useRouter: () => ({ replace: replaceMock, push: vi.fn() }),
}));

vi.mock("@/utils/axios", () => ({
    default: { get: vi.fn() },
}));

function fakeJwt(claims) {
    const b64 = (obj) => Buffer.from(JSON.stringify(obj)).toString("base64url");
    return `${b64({ alg: "none" })}.${b64({ exp: Math.floor(Date.now() / 1000) + 3600, ...claims })}.sig`;
}

describe("useAuth", () => {
    beforeEach(() => {
        replaceMock.mockClear();
        axiosInstance.get.mockReset();
        window.localStorage.clear();
    });

    // Regression test for the production bug: every /cats/admin/* page and
    // every page behind useAdminTierGate/useOwnerOnlyGate redirected back to
    // /cats immediately on load, even for a real OWNER. Root cause: the
    // role-resolution effect ran once on mount using `token`'s *initial*
    // (pre-localStorage-read) value of null, concluded "not logged in", and
    // set roleReady=true with role=null for one render -- enough for a
    // role-gated consumer to redirect away before the real role ever loaded.
    it("never reports roleReady with a null role before localStorage has actually been read, for a logged-in OWNER", async () => {
        window.localStorage.setItem("authToken", fakeJwt({ sub: "owner@strongg.us" }));
        window.localStorage.setItem("authTokenTimestamp", String(Date.now()));
        axiosInstance.get.mockResolvedValue({ data: { email: "owner@strongg.us", role: "OWNER" } });

        const seenRoleReadyWithNullRole = [];
        const { result } = renderHook(() => {
            const auth = useAuth();
            if (auth.roleReady && auth.role === null) seenRoleReadyWithNullRole.push(true);
            return auth;
        });

        await waitFor(() => expect(result.current.roleReady).toBe(true));
        expect(result.current.role).toBe("OWNER");
        expect(seenRoleReadyWithNullRole).toHaveLength(0);
    });

    it("useAdminTierGate never redirects an OWNER away from an admin-tier page", async () => {
        window.localStorage.setItem("authToken", fakeJwt({ sub: "owner@strongg.us" }));
        window.localStorage.setItem("authTokenTimestamp", String(Date.now()));
        axiosInstance.get.mockResolvedValue({ data: { email: "owner@strongg.us", role: "OWNER" } });

        const { result } = renderHook(() => useAdminTierGate());

        await waitFor(() => expect(result.current.ready).toBe(true));
        expect(replaceMock).not.toHaveBeenCalled();
    });

    it("useOwnerOnlyGate never redirects an OWNER away from the Users & Roles page", async () => {
        window.localStorage.setItem("authToken", fakeJwt({ sub: "owner@strongg.us" }));
        window.localStorage.setItem("authTokenTimestamp", String(Date.now()));
        axiosInstance.get.mockResolvedValue({ data: { email: "owner@strongg.us", role: "OWNER" } });

        const { result } = renderHook(() => useOwnerOnlyGate());

        await waitFor(() => expect(result.current.ready).toBe(true));
        expect(replaceMock).not.toHaveBeenCalled();
    });

    it("useAdminTierGate still redirects a real WORKER away (the gate itself is not disabled by the fix)", async () => {
        window.localStorage.setItem("authToken", fakeJwt({ sub: "worker@strongg.us" }));
        window.localStorage.setItem("authTokenTimestamp", String(Date.now()));
        axiosInstance.get.mockResolvedValue({ data: { email: "worker@strongg.us", role: "WORKER" } });

        renderHook(() => useAdminTierGate());

        await waitFor(() => expect(replaceMock).toHaveBeenCalledWith("/worker"));
    });

    it("resolves roleReady=true with role=null when no token exists at all (no redirect loop, no infinite loading)", async () => {
        const { result } = renderHook(() => useAuth());

        await waitFor(() => expect(result.current.roleReady).toBe(true));
        expect(result.current.role).toBeNull();
        expect(result.current.isLoggedIn).toBe(false);
        expect(axiosInstance.get).not.toHaveBeenCalled();
    });
});
