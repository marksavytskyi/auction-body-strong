"use client";

import { useCallback, useRef, useState } from "react";

// The small part of a form library these forms actually use. `validate`
// returns { field: message } for invalid fields; errors show after a field is
// blurred or the form is submitted.
export function useSimpleForm({ initialValues, validate, onSubmit }) {
    const [values, setValues] = useState(initialValues);
    const [touched, setTouched] = useState({});
    const [status, setStatus] = useState(undefined);
    const [isSubmitting, setSubmitting] = useState(false);
    // A double tap arrives before React re-renders with isSubmitting=true.
    const submittingRef = useRef(false);

    const errors = validate(values);

    const field = (name) => ({
        id: name,
        name,
        value: values[name],
        onChange: (event) => {
            const { value } = event.target;
            setValues((current) => ({ ...current, [name]: value }));
        },
        onBlur: () => setTouched((current) => ({ ...current, [name]: true })),
    });

    const handleSubmit = useCallback(
        async (event) => {
            event?.preventDefault();
            if (submittingRef.current) return;
            setTouched(Object.fromEntries(Object.keys(initialValues).map((name) => [name, true])));
            if (Object.keys(validate(values)).length > 0) return;

            submittingRef.current = true;
            setSubmitting(true);
            setStatus(undefined);
            try {
                await onSubmit(values, { setStatus, resetForm: () => setValues(initialValues) });
            } finally {
                submittingRef.current = false;
                setSubmitting(false);
            }
        },
        [initialValues, validate, values, onSubmit]
    );

    const shownError = (name) => (touched[name] ? errors[name] : undefined);

    return { values, field, shownError, status, isSubmitting, handleSubmit };
}

// Same accept/reject rule as before: one @, something either side, no spaces.
export const isValidEmail = (value) => /^[^\s@]+@[^\s@]+$/.test(value);
