import { describe, expect, it } from "vitest";

import { request, CatalyticApiError } from "../http";

function rejecting(error) {
    return () => Promise.reject(error);
}

describe("request / extractErrorMessage — error shape handling", () => {
    it("uses a plain string detail as-is (existing behavior, every non-Operations catalytic module relies on this)", async () => {
        const error = { response: { status: 400, data: { detail: "Only .csv files are allowed" } } };
        await expect(request(rejecting(error), "fallback")).rejects.toMatchObject({
            message: "Only .csv files are allowed", status: 400,
        });
    });

    it("formats a FastAPI 422 validation-error array into a readable string, never a raw array", async () => {
        const error = {
            response: {
                status: 422,
                data: { detail: [{ loc: ["body", "confirm"], msg: "Input should be a valid boolean", type: "bool_type" }] },
            },
        };
        const err = await request(rejecting(error), "fallback").catch((e) => e);
        expect(err).toBeInstanceOf(CatalyticApiError);
        expect(err.status).toBe(422);
        expect(typeof err.message).toBe("string");
        expect(err.message).toContain("body.confirm");
        expect(err.message).toContain("Input should be a valid boolean");
    });

    it("joins multiple validation-error array items into one message", async () => {
        const error = {
            response: {
                status: 422,
                data: {
                    detail: [
                        { loc: ["body", "confirm"], msg: "Input should be a valid boolean", type: "bool_type" },
                        { loc: ["body", "max_new_searches"], msg: "Input should be greater than or equal to 0", type: "greater_than_equal" },
                    ],
                },
            },
        };
        const err = await request(rejecting(error), "fallback").catch((e) => e);
        expect(err.message).toContain("body.confirm");
        expect(err.message).toContain("body.max_new_searches");
        expect(err.message).toContain(";");
    });

    it("falls back safely for a validation-array item that isn't the expected {loc,msg} shape", async () => {
        const error = { response: { status: 422, data: { detail: ["just a string item", 42, null] } } };
        const err = await request(rejecting(error), "fallback").catch((e) => e);
        expect(typeof err.message).toBe("string");
        expect(err.message).toContain("just a string item");
    });

    it("never returns a raw object/array as the error message for an unrecognized detail shape", async () => {
        const error = { response: { status: 500, data: { detail: { unexpected: "shape" } } } };
        const err = await request(rejecting(error), "fallback message").catch((e) => e);
        expect(typeof err.message).toBe("string");
        expect(err.message).not.toContain("[object Object]");
    });

    it("falls back to response.data.message when detail is absent", async () => {
        const error = { response: { status: 403, data: { message: "Insufficient permissions" } } };
        const err = await request(rejecting(error), "fallback").catch((e) => e);
        expect(err.message).toBe("Insufficient permissions");
        expect(err.status).toBe(403);
    });

    it("falls back to error.message for a network-level failure with no response at all", async () => {
        const error = new Error("Network Error");
        const err = await request(rejecting(error), "fallback").catch((e) => e);
        expect(err.message).toBe("Network Error");
        expect(err.status).toBeUndefined();
    });

    it("falls back to the caller-supplied fallback message when nothing else is available", async () => {
        const error = {};
        const err = await request(rejecting(error), "Failed to do the thing").catch((e) => e);
        expect(err.message).toBe("Failed to do the thing");
    });

    it("never exposes an internal stack trace in the resulting message", async () => {
        const error = { response: { status: 500, data: {} }, stack: "Error: boom\n  at someInternalFunction (/app/secret/path.js:42:10)" };
        const err = await request(rejecting(error), "Internal error").catch((e) => e);
        expect(err.message).not.toContain("someInternalFunction");
        expect(err.message).not.toContain(".js:");
    });

    it("resolves successfully and returns response.data when the call succeeds", async () => {
        const result = await request(() => Promise.resolve({ data: { ok: true } }), "fallback");
        expect(result).toEqual({ ok: true });
    });
});
