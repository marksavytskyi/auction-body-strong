export function formatBytes(bytes) {
    const units = ["B", "KB", "MB", "GB"];
    let i = 0;
    let n = bytes || 0;
    while (n >= 1024 && i < units.length - 1) {
        n /= 1024;
        i++;
    }
    return `${n.toFixed(i === 0 ? 0 : 2)} ${units[i]}`;
}

export const fmtDurationMs = (ms) => {
    const n = Number(ms ?? 0)
    if (!Number.isFinite(n) || n <= 0) return "—"
    
    if (n < 1000) return `${n}ms`
    
    const totalSec = Math.floor(n / 1000)
    const hours = Math.floor(totalSec / 3600)
    const minutes = Math.floor((totalSec % 3600) / 60)
    const seconds = totalSec % 60
    
    const parts = []
    if (hours > 0) parts.push(`${hours}h`)
    if (minutes > 0 || hours > 0) parts.push(`${minutes}m`)
    parts.push(`${seconds}s`)
    
    return parts.join(" ")
}

export function clamp(n, min, max) {
    return Math.max(min, Math.min(max, n));
}

export function formatDuration(totalSec) {
    const s = Math.max(0, Number(totalSec || 0));
    const hours = Math.floor(s / 3600);
    const mm = Math.floor((s % 3600) / 60);
    const ss = Math.floor(s % 60);
    
    const parts = [];
    if (hours > 0) parts.push(`${hours}h`);
    if (mm > 0 || hours > 0) parts.push(`${mm}m`);
    parts.push(`${ss}s`);
    
    return parts.join(" ");
}

export function safeJsonParse(v) {
    if (v == null) return null;
    if (typeof v === "object") return v;
    const s = String(v).trim();
    if (!s || s === "-" || s.toLowerCase() === "null") return null;
    try {
        return JSON.parse(s);
    } catch {
        return null;
    }
}
