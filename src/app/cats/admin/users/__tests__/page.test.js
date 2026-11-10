import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import UsersRolesPage from "../page";
import { deleteUser, listUserEvents, listUsers, restoreUser, setUserActive, setUserRole } from "@/lib/catalytic/users";
import toast from "react-hot-toast";

const auth = vi.hoisted(() => ({ role: "OWNER", email: "owner@example.com" }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: vi.fn(), push: vi.fn() }) }));
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ ready: true, roleReady: true, isLoggedIn: true, role: auth.role, email: auth.email }) }));
vi.mock("@/lib/catalytic/users", () => ({ listUsers: vi.fn(), listUserEvents: vi.fn(), setUserRole: vi.fn(), setUserActive: vi.fn(), deleteUser: vi.fn(), restoreUser: vi.fn() }));
vi.mock("react-hot-toast", () => ({ default: { success: vi.fn(), error: vi.fn() } }));

// Phase K.50 — Users & Roles for any number of owners.

const user = (id, email, role, extra = {}) => ({ id, email, role, is_active: true, deleted_at: null, ...extra });
const PEOPLE = [
    user(5, "owner@example.com", "OWNER"),
    user(13, "info@example.com", "ADMIN"),
    user(8, "worker@example.com", "WORKER"),
    user(4, "old@example.com", "WORKER", { is_active: false }),
];

const table = () => screen.getByRole("table");
const rowOf = (email) => within(table()).getByText(email).closest("tr");

beforeEach(() => {
    vi.clearAllMocks();
    auth.role = "OWNER";
    auth.email = "owner@example.com";
    listUsers.mockResolvedValue(PEOPLE);
    listUserEvents.mockResolvedValue([]);
    for (const fn of [setUserRole, setUserActive, deleteUser, restoreUser]) fn.mockResolvedValue({});
});

describe("Users & Roles", () => {
    it("shows Email, Role, Status and Actions, with OWNER as a visible role", async () => {
        render(<UsersRolesPage />);
        await screen.findByRole("table");
        expect(within(table()).getAllByRole("columnheader").map((h) => h.textContent)).toEqual(["Email", "Role", "Status", "Actions"]);
        expect(within(rowOf("owner@example.com")).getByText("OWNER")).toBeInTheDocument();
        expect(within(rowOf("old@example.com")).getByText("Inactive")).toBeInTheDocument();
    });

    it("an owner can offer OWNER to an existing account, after confirming what it means", async () => {
        render(<UsersRolesPage />);
        await screen.findByRole("table");
        const select = within(rowOf("info@example.com")).getByLabelText("Role of info@example.com");
        expect(Array.from(select.options).map((o) => o.value)).toEqual(["WORKER", "MODERATOR", "ADMIN", "OWNER"]);
        fireEvent.change(select, { target: { value: "OWNER" } });
        const dialog = screen.getByRole("dialog", { name: "Change info@example.com to OWNER?" });
        expect(within(dialog).getByText(/gets every OWNER right, the same as yours/)).toBeInTheDocument();
        expect(setUserRole).not.toHaveBeenCalled();
        fireEvent.click(within(dialog).getByRole("button", { name: "Make OWNER" }));
        await waitFor(() => expect(setUserRole).toHaveBeenCalledWith(13, "OWNER"));
        expect(toast.success).toHaveBeenCalledWith("info@example.com is now OWNER");
        await waitFor(() => expect(listUserEvents).toHaveBeenCalledTimes(2));
    });

    it("Go back changes nothing", async () => {
        render(<UsersRolesPage />);
        await screen.findByRole("table");
        fireEvent.change(within(rowOf("worker@example.com")).getByLabelText("Role of worker@example.com"), { target: { value: "ADMIN" } });
        fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Go back" }));
        expect(screen.queryByRole("dialog")).toBeNull();
        expect(setUserRole).not.toHaveBeenCalled();
    });

    it("your own row and the only active owner are locked, with the reason", async () => {
        render(<UsersRolesPage />);
        await screen.findByRole("table");
        const mine = rowOf("owner@example.com");
        expect(within(mine).queryByRole("combobox")).toBeNull();
        expect(within(mine).getByRole("button", { name: "Delete" })).toBeDisabled();
        expect(within(mine).getByRole("button", { name: "Deactivate" })).toBeDisabled();
        expect(within(mine).getByText("(you)")).toBeInTheDocument();
    });

    it("with two owners, each can manage the other", async () => {
        listUsers.mockResolvedValue([user(5, "owner@example.com", "OWNER"), user(13, "info@example.com", "OWNER")]);
        render(<UsersRolesPage />);
        await screen.findByRole("table");
        const other = rowOf("info@example.com");
        expect(within(other).getByLabelText("Role of info@example.com")).toBeEnabled();
        expect(within(other).getByRole("button", { name: "Delete" })).toBeEnabled();
        fireEvent.change(within(other).getByLabelText("Role of info@example.com"), { target: { value: "ADMIN" } });
        expect(screen.getByText(/stops being an OWNER and loses owner-only rights at once/)).toBeInTheDocument();
    });

    it("the only active owner can't be removed by another, inactive owner's row either", async () => {
        listUsers.mockResolvedValue([user(5, "owner@example.com", "OWNER"), user(13, "info@example.com", "OWNER", { is_active: false })]);
        auth.email = "someone-else@example.com";
        render(<UsersRolesPage />);
        await screen.findByRole("table");
        expect(within(rowOf("owner@example.com")).getByRole("button", { name: "Delete" })).toBeDisabled();
        expect(within(rowOf("info@example.com")).getByRole("button", { name: "Activate" })).toBeEnabled();
    });

    it("deleting needs the email typed, says what is kept, then reloads", async () => {
        render(<UsersRolesPage />);
        await screen.findByRole("table");
        fireEvent.click(within(rowOf("worker@example.com")).getByRole("button", { name: "Delete" }));
        const dialog = screen.getByRole("dialog", { name: "Delete worker@example.com?" });
        expect(within(dialog).getByText(/captures, reviews, sales, batches and every other record keep their name/)).toBeInTheDocument();
        const go = within(dialog).getByRole("button", { name: "Delete user" });
        expect(go).toBeDisabled();
        fireEvent.change(within(dialog).getByLabelText("Type the email to confirm"), { target: { value: "worker@example" } });
        expect(go).toBeDisabled();
        fireEvent.change(within(dialog).getByLabelText("Type the email to confirm"), { target: { value: "Worker@Example.com " } });
        expect(go).toBeEnabled();
        fireEvent.click(go);
        await waitFor(() => expect(deleteUser).toHaveBeenCalledWith(8));
        expect(toast.success).toHaveBeenCalledWith("worker@example.com deleted");
        await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
        expect(listUserEvents).toHaveBeenCalledTimes(2);
    });

    it("deactivating is separate, reversible, and says so", async () => {
        render(<UsersRolesPage />);
        await screen.findByRole("table");
        fireEvent.click(within(rowOf("worker@example.com")).getByRole("button", { name: "Deactivate" }));
        const dialog = screen.getByRole("dialog", { name: "Deactivate worker@example.com?" });
        expect(within(dialog).getByText(/They stay in this list/)).toBeInTheDocument();
        fireEvent.click(within(dialog).getByRole("button", { name: "Deactivate" }));
        await waitFor(() => expect(setUserActive).toHaveBeenCalledWith(8, false));
        fireEvent.click(within(rowOf("old@example.com")).getByRole("button", { name: "Activate" }));
        fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Activate" }));
        await waitFor(() => expect(setUserActive).toHaveBeenCalledWith(4, true));
        expect(deleteUser).not.toHaveBeenCalled();
    });

    it("deleted users appear only when asked, and can be restored", async () => {
        render(<UsersRolesPage />);
        await screen.findByRole("table");
        expect(listUsers).toHaveBeenCalledWith({ includeDeleted: false });
        listUsers.mockResolvedValue([...PEOPLE, user(12, "gone@example.com", "WORKER", { is_active: false, deleted_at: "2026-11-10T09:00:00" })]);
        fireEvent.click(screen.getByLabelText("Show deleted users"));
        await within(await screen.findByRole("table")).findByText("gone@example.com");
        await waitFor(() => expect(listUsers.mock.calls.filter(([a]) => a.includeDeleted).length).toBeGreaterThanOrEqual(2));
        const gone = rowOf("gone@example.com");
        expect(within(gone).getByText("Deleted")).toBeInTheDocument();
        expect(within(gone).queryByRole("combobox")).toBeNull();
        fireEvent.click(within(gone).getByRole("button", { name: "Restore" }));
        expect(screen.getByText(/come back to the list deactivated/)).toBeInTheDocument();
        fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Restore" }));
        await waitFor(() => expect(restoreUser).toHaveBeenCalledWith(12));
    });

    it("shows the server's refusal and keeps the dialog open", async () => {
        const { CatalyticApiError } = await import("@/lib/catalytic/api");
        deleteUser.mockRejectedValue(new CatalyticApiError("cannot delete the last active OWNER", { status: 400 }));
        render(<UsersRolesPage />);
        await screen.findByRole("table");
        fireEvent.click(within(rowOf("info@example.com")).getByRole("button", { name: "Delete" }));
        fireEvent.change(screen.getByLabelText("Type the email to confirm"), { target: { value: "info@example.com" } });
        fireEvent.click(screen.getByRole("button", { name: "Delete user" }));
        await waitFor(() => expect(toast.error).toHaveBeenCalledWith("cannot delete the last active OWNER"));
        expect(screen.getByRole("dialog")).toBeInTheDocument();
    });

    it.each(["ADMIN", "MODERATOR", "WORKER"])("a %s sees nothing and loads nothing", (role) => {
        auth.role = role;
        const { container } = render(<UsersRolesPage />);
        expect(container).toBeEmptyDOMElement();
        expect(listUsers).not.toHaveBeenCalled();
    });

    it("the phone layout has the same controls", async () => {
        render(<UsersRolesPage />);
        await screen.findByRole("table");
        const cards = screen.getByLabelText("Users");
        expect(within(cards).getAllByRole("button", { name: "Delete" })).toHaveLength(4);
        expect(within(cards).getByLabelText("Role of info@example.com")).toBeInTheDocument();
    });

    it("shows the recent changes the server logged, by email", async () => {
        listUserEvents.mockResolvedValue([
            { id: 2, actor_user_id: 5, target_user_id: 13, action: "OWNER_PROMOTED", previous_value: "ADMIN", new_value: "OWNER", created_at: "2026-11-10T09:00:00" },
            { id: 1, actor_user_id: 5, target_user_id: 77, action: "DELETED", previous_value: "ACTIVE", new_value: "DELETED", created_at: "2026-11-10T08:00:00" },
        ]);
        render(<UsersRolesPage />);
        const log = await screen.findByRole("region", { name: "Recent changes" });
        expect(within(log).getByText(/made OWNER \(ADMIN → OWNER\) by owner@example.com/)).toBeInTheDocument();
        expect(within(log).getByText("user #77")).toBeInTheDocument();
    });

    it("the table still works when the log can't load", async () => {
        listUserEvents.mockRejectedValue(new Error("down"));
        render(<UsersRolesPage />);
        await screen.findByRole("table");
        expect(screen.queryByRole("region", { name: "Recent changes" })).toBeNull();
    });
});
