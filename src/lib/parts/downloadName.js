// The name the server gives the file: the same one the completion email uses.
export const downloadName = (disposition, fallback) => {
    const header = String(disposition || "");
    const encoded = /filename\*=UTF-8''([^;]+)/i.exec(header);
    if (encoded) {
        try {
            return decodeURIComponent(encoded[1].trim());
        } catch {
            // fall through to the plain name
        }
    }
    const plain = /filename="([^"]+)"/i.exec(header);
    return plain ? plain[1] : fallback;
};
