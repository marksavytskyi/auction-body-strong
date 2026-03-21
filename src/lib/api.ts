const API_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "https://api.strongg.us";

export async function apiLogin(email: string, password: string) {
    const res = await fetch(`${API_URL}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
        throw new Error(data?.detail || `Login failed (${res.status})`);
    }

    return data as { access_token: string; token_type: string };
}

export async function apiMe(token: string) {
    const res = await fetch(`${API_URL}/auth/me`, {
        headers: { Authorization: `Bearer ${token}` },
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
        throw new Error(data?.detail || `Me failed (${res.status})`);
    }

    return data as { email: string };
}