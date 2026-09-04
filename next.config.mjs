/** @type {import('next').NextConfig} */
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(fileURLToPath(import.meta.url));

const nextConfig = {
turbopack: {
root,
},
allowedDevOrigins: ["172.18.2.42", "192.168.137.1"],
};

export default nextConfig;
