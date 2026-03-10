import { resolve } from "node:path";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { smssDevProxy } from "./plugins/smssDevProxy.js";

export default defineConfig({
	plugins: [react(), tailwindcss(), smssDevProxy()],
	resolve: {
		alias: {
			"@": resolve(__dirname, "src"),
		},
	},
});
