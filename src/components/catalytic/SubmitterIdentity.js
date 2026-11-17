"use client";

import React from "react";

// K.62 — who a user id is, for the moderation screens. The backend fills `identity` in for
// administrators only ({ user_id, email, display_name, account_status }); everyone else gets
// null and sees the numeric id, as before.
const STATUS_NOTE = { DELETED: "deleted account", INACTIVE: "inactive account", MISSING: "account not found" };

export function identityLabel(identity, userId) {
    if (identity?.email) {
        return identity.display_name ? `${identity.display_name} (${identity.email})` : identity.email;
    }
    return `user #${identity?.user_id ?? userId}`;
}

export default function SubmitterIdentity({ identity, userId, prefix = "Submitted by:", submittedAt = null, fmtDate = null }) {
    const id = identity?.user_id ?? userId;
    const note = STATUS_NOTE[identity?.account_status];
    return (
        <span data-testid="submitter-identity">
            {prefix} <span className="font-bold text-white/75">{identityLabel(identity, userId)}</span>
            {identity?.email && <span className="text-white/30">{` · user #${id}`}</span>}
            {note && <span className="text-amber-300/80">{` · ${note}`}</span>}
            {submittedAt && fmtDate && <span className="text-white/35">{` · ${fmtDate(submittedAt)}`}</span>}
        </span>
    );
}
