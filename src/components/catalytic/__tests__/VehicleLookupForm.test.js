import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import VehicleLookupForm from "../VehicleLookupForm";

const set = (label, value) => fireEvent.change(screen.getByLabelText(label), { target: { value } });
const submit = () => fireEvent.click(screen.getByRole("button", { name: /look up vehicle/i }));

describe("VehicleLookupForm", () => {
    it("keeps the backend's year bounds and required fields", async () => {
        const onSubmit = vi.fn();
        render(<VehicleLookupForm onSubmit={onSubmit} />);
        set("Year", "1979");
        submit();
        expect(await screen.findByText("Year must be 1980 or later")).toBeInTheDocument();
        expect(screen.getByText("Make is required")).toBeInTheDocument();
        expect(screen.getByText("Model is required")).toBeInTheDocument();
        expect(onSubmit).not.toHaveBeenCalled();
    });

    it("rejects a VIN of the wrong length but allows none", async () => {
        const onSubmit = vi.fn();
        render(<VehicleLookupForm onSubmit={onSubmit} />);
        set("Year", "2007");
        set("Make", "Toyota");
        set("Model", "Prius");
        set(/^VIN/, "ABC");
        submit();
        expect(await screen.findByText("VIN should be 17 characters")).toBeInTheDocument();
        expect(onSubmit).not.toHaveBeenCalled();

        set(/^VIN/, "");
        submit();
        await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
        const [values, helpers] = onSubmit.mock.calls[0];
        expect(values).toMatchObject({ year: 2007, make: "Toyota", model: "Prius", vin: "" });
        expect(typeof helpers.setSubmitting).toBe("function");
    });
});
