// vitest.config.ts
//
// Scoped to eval specs (src/tests/evals/**/*.eval.ts) only. These hit the
// real LLM API and are non-deterministic — see CLAUDE.md's testing
// conventions. Fast/mocked unit tests added later should get their own
// config/script rather than widening this include pattern, so `npm run
// eval:extraction` never silently grows into a general `npm test`.
import { loadEnv } from "vite";
import { defineConfig } from "vitest/config";

export default defineConfig(({ mode }) => {
	Object.assign(process.env, loadEnv(mode, process.cwd(), ""));

	return {
		test: {
			include: ["src/tests/evals/**/*.eval.ts"],
			environment: "node",
			testTimeout: 90_000,
		},
	};
});
