"use client";

import { useLayoutEffect, useRef, useState } from "react";

// Full-screen layers are all portalled to <body>, so what decides which is on
// top is the order they opened in, not a z-index each one guesses. Escape goes
// to the top layer only, and the page stays locked until the last one closes.
const BASE_Z_INDEX = 1000;
const stack = [];
let bodyOverflow = "";

function onKeyDown(event) {
    if (event.key === "Escape" && stack.length > 0) stack[stack.length - 1].close();
}

function push(entry) {
    if (stack.length === 0) {
        document.addEventListener("keydown", onKeyDown);
        bodyOverflow = document.body.style.overflow;
        document.body.style.overflow = "hidden";
    }
    stack.push(entry);
    return stack.length;
}

function remove(entry) {
    stack.splice(stack.indexOf(entry), 1);
    if (stack.length === 0) {
        document.removeEventListener("keydown", onKeyDown);
        document.body.style.overflow = bodyOverflow;
    }
}

export function useModalLayer(isOpen, onClose) {
    const [zIndex, setZIndex] = useState(BASE_Z_INDEX);
    const closeRef = useRef(onClose);
    closeRef.current = onClose;

    useLayoutEffect(() => {
        if (!isOpen) return undefined;
        const entry = { close: () => closeRef.current?.() };
        setZIndex(BASE_Z_INDEX + push(entry) * 10);
        return () => remove(entry);
    }, [isOpen]);

    return zIndex;
}
