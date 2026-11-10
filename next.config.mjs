/** @type {import('next').NextConfig} */
const nextConfig = {
    // Phase K.51: pages removed from CATS. Bookmarks land where the work now lives.
    // Not permanent, so a browser never caches them forever.
    async redirects() {
        return [
            { source: "/cats/batch", destination: "/operations", permanent: false },
            { source: "/cats/admin/copart", destination: "/operations", permanent: false },
            { source: "/cats/admin/copart/:id", destination: "/operations", permanent: false },
            { source: "/cats/admin/catdb-batches", destination: "/cats/admin/catdb", permanent: false },
            { source: "/cats/admin/catdb-batches/:id", destination: "/cats/admin/catdb", permanent: false },
            { source: "/cats/admin/corrections", destination: "/cats/converters", permanent: false },
            { source: "/cats/admin/workers", destination: "/cats/admin/users", permanent: false },
            { source: "/cats/admin/workers/:id", destination: "/cats/admin/users?worker=:id", permanent: false },
        ];
    },
};

export default nextConfig;
