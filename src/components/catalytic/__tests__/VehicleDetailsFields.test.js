import React, { useState } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import VehicleDetailsFields, { vehicleCanContinue } from "../VehicleDetailsFields";
import { lookupVin } from "@/lib/catalytic/workerCaptures";
import { CatalyticApiError } from "@/lib/catalytic/api";

vi.mock("@/lib/catalytic/workerCaptures", async () => ({
    ...(await vi.importActual("@/lib/catalytic/workerCaptures")),
    lookupVin: vi.fn(),
}));
vi.mock("next/dynamic", () => ({
    default: () => function ScannerStub({ onDetected, onClose }) {
        return (
            <div>
                <button type="button" onClick={() => onDetected(VIN)}>stub detect</button>
                <button type="button" onClick={onClose}>stub close</button>
            </div>
        );
    },
}));

const VIN = "1GNSKCKC8HR225261";
const DECODED = {
    vin: VIN, check_digit_valid: true, source: "NHTSA", found_existing: false, year: 2017, make: "Chevrolet",
    model: "Tahoe", engine: "5.3L", message: null, own_capture: null, approved_elsewhere: false,
};

function Harness({ initial = {}, ...props }) {
    const [value, setValue] = useState({ vin: "", year: "", make: "", model: "", engine: "", ...initial });
    return (
        <>
            <VehicleDetailsFields value={value} onChange={setValue} {...props} />
            <output data-testid="value">{JSON.stringify(value)}</output>
        </>
    );
}

const current = () => JSON.parse(screen.getByTestId("value").textContent);
const typeVin = (vin) => fireEvent.change(screen.getByLabelText("VIN"), { target: { value: vin } });

beforeEach(() => {
    vi.clearAllMocks();
    lookupVin.mockResolvedValue(DECODED);
});

describe("VIN entry", () => {
    it("offers scanning and manual entry", () => {
        render(<Harness />);
        expect(screen.getByRole("button", { name: "Scan VIN" })).toBeInTheDocument();
        fireEvent.click(screen.getByRole("button", { name: "Enter Manually" }));
        expect(screen.getByLabelText("VIN")).toHaveFocus();
    });

    it("normalizes what is typed", () => {
        render(<Harness />);
        typeVin("1gnsk-ckc8h r225261");
        expect(current().vin).toBe(VIN);
    });

    it("explains an invalid VIN and does not look it up", () => {
        render(<Harness />);
        typeVin("1GNSKCKC8HR22526I");
        expect(screen.getByRole("alert")).toHaveTextContent(/never contains I, O or Q/);
        expect(lookupVin).not.toHaveBeenCalled();
    });

    it("warns about a failed check digit without blocking", async () => {
        render(<Harness autofill />);
        typeVin("1FTFW1EG8JFC12345");
        expect(await screen.findByText(/fails the standard check digit/)).toBeInTheDocument();
        await waitFor(() => expect(lookupVin).toHaveBeenCalled());
        expect(vehicleCanContinue(current())).toBe(true);
    });

    it("looks up a scanned VIN after it is confirmed", async () => {
        render(<Harness autofill />);
        fireEvent.click(screen.getByRole("button", { name: "Scan VIN" }));
        fireEvent.click(await screen.findByRole("button", { name: "stub detect" }));
        await waitFor(() => expect(lookupVin).toHaveBeenCalledWith(VIN));
        expect(current().vin).toBe(VIN);
    });
});

describe("decoding", () => {
    it("fills every field", async () => {
        render(<Harness autofill />);
        typeVin(VIN);
        await waitFor(() => expect(current()).toMatchObject({ year: "2017", make: "Chevrolet", model: "Tahoe", engine: "5.3L" }));
    });

    it("keeps every decoded field editable", async () => {
        render(<Harness autofill />);
        typeVin(VIN);
        await waitFor(() => expect(current().make).toBe("Chevrolet"));
        fireEvent.change(screen.getByLabelText("Make"), { target: { value: "GMC" } });
        fireEvent.change(screen.getByLabelText("Year"), { target: { value: "2018" } });
        fireEvent.change(screen.getByLabelText("Model"), { target: { value: "Yukon" } });
        fireEvent.change(screen.getByLabelText("Engine"), { target: { value: "6.2L" } });
        expect(current()).toMatchObject({ make: "GMC", year: "2018", model: "Yukon", engine: "6.2L" });
    });

    it("never overwrites what the worker already typed", async () => {
        render(<Harness autofill />);
        fireEvent.change(screen.getByLabelText("Engine"), { target: { value: "6.2L" } });
        typeVin(VIN);
        await waitFor(() => expect(current().make).toBe("Chevrolet"));
        expect(current().engine).toBe("6.2L");
    });

    it("leaves an unconfirmed engine blank and says so", async () => {
        lookupVin.mockResolvedValue({ ...DECODED, engine: "", message: "Engine could not be confirmed. Please enter it manually." });
        render(<Harness autofill />);
        typeVin(VIN);
        expect(await screen.findByText("Engine could not be confirmed. Please enter it manually.")).toBeInTheDocument();
        expect(current().engine).toBe("");
        expect(current().make).toBe("Chevrolet");
    });

    it("falls back to manual entry when the decoder is down", async () => {
        lookupVin.mockResolvedValue({ ...DECODED, source: "NONE", year: null, make: "", model: "", engine: "", message: "The VIN decoder is unavailable right now. Please enter the details manually." });
        render(<Harness autofill />);
        typeVin(VIN);
        expect(await screen.findByText(/decoder is unavailable/)).toBeInTheDocument();
        fireEvent.change(screen.getByLabelText("Make"), { target: { value: "Ford" } });
        expect(current().make).toBe("Ford");
    });

    it("does not block the worker when the lookup itself fails", async () => {
        lookupVin.mockRejectedValue(new CatalyticApiError("Network error"));
        render(<Harness autofill />);
        typeVin(VIN);
        expect(await screen.findByText(/VIN lookup failed/)).toBeInTheDocument();
        expect(vehicleCanContinue(current())).toBe(true);
    });

    it("ignores the answer for a VIN the worker has moved on from", async () => {
        let resolveFirst;
        lookupVin.mockReturnValueOnce(new Promise((resolve) => { resolveFirst = resolve; }));
        render(<Harness autofill />);
        typeVin(VIN);
        typeVin("");
        resolveFirst(DECODED);
        await new Promise((resolve) => setTimeout(resolve, 10));
        expect(current().make).toBe("");
    });
});

describe("a vehicle already known", () => {
    const known = { ...DECODED, source: "STRONGG_VEHICLE", found_existing: true, make: "Chevrolet", engine: "5.3L V8" };

    it("offers it instead of applying it", async () => {
        lookupVin.mockResolvedValue(known);
        render(<Harness autofill />);
        typeVin(VIN);
        expect(await screen.findByText("Vehicle found")).toBeInTheDocument();
        expect(screen.getByText("2017 Chevrolet Tahoe")).toBeInTheDocument();
        expect(current().make).toBe("");
        fireEvent.click(screen.getByRole("button", { name: "Use Vehicle Details" }));
        expect(current()).toMatchObject({ make: "Chevrolet", model: "Tahoe", year: "2017", engine: "5.3L V8" });
        fireEvent.change(screen.getByLabelText("Engine"), { target: { value: "6.2L" } });
        expect(current().engine).toBe("6.2L");
    });

    it("points to the worker's own unfinished capture", async () => {
        lookupVin.mockResolvedValue({ ...DECODED, own_capture: { id: 42, status: "DRAFT" } });
        render(<Harness autofill />);
        typeVin(VIN);
        expect(await screen.findByRole("link", { name: "Open it" })).toHaveAttribute("href", "/worker/captures/42");
    });

    it("warns when another submission is already approved", async () => {
        lookupVin.mockResolvedValue({ ...DECODED, approved_elsewhere: true });
        render(<Harness autofill />);
        typeVin(VIN);
        expect(await screen.findByText(/already has an approved submission/)).toBeInTheDocument();
    });
});

describe("while editing a saved submission", () => {
    const saved = { vin: VIN, year: "2017", make: "Chevrolet", model: "Tahoe", engine: "5.3L" };

    it("does not look up the VIN it opened with", () => {
        render(<Harness initial={saved} captureId={7} />);
        expect(lookupVin).not.toHaveBeenCalled();
    });

    it("offers a new VIN's details rather than overwriting saved ones", async () => {
        lookupVin.mockResolvedValue({ ...DECODED, vin: "1FTFW1EG8JFC12345", make: "Ford", model: "F-150" });
        render(<Harness initial={saved} captureId={7} />);
        typeVin("1FTFW1EG8JFC12345");
        expect(await screen.findByText("VIN decoded")).toBeInTheDocument();
        expect(current().make).toBe("Chevrolet");
        fireEvent.click(screen.getByRole("button", { name: "Use Vehicle Details" }));
        expect(current().make).toBe("Ford");
    });

    it("doesn't send the worker to the submission they are editing", async () => {
        lookupVin.mockResolvedValue({ ...DECODED, own_capture: { id: 7, status: "PENDING_REVIEW" } });
        render(<Harness initial={{ ...saved, vin: "" }} captureId={7} />);
        typeVin(VIN);
        await waitFor(() => expect(lookupVin).toHaveBeenCalled());
        expect(screen.queryByRole("link", { name: "Open it" })).not.toBeInTheDocument();
    });
});

describe("vehicleCanContinue", () => {
    const blank = { vin: "", year: "", make: "", model: "", engine: "" };
    it.each([
        [{ ...blank }, false],
        [{ ...blank, vin: VIN }, true],
        [{ ...blank, vin: "SHORT", year: "2017", make: "a", model: "b" }, false],
        [{ ...blank, year: "2017", make: "a", model: "b" }, true],
        [{ ...blank, year: "2017", make: "a", model: " " }, false],
    ])("%j", (value, expected) => expect(vehicleCanContinue(value)).toBe(expected));
});
