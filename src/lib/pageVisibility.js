// Background tabs shouldn't keep polling; the next tick after the user returns catches up.
export const isPageHidden = () => typeof document !== "undefined" && document.hidden;
