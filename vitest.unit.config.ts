// vitest.unit.config.ts
//
// Fast, deterministic unit tests only — no real LLM calls, no network, safe
// to run on every save / in CI. Kept separate from vitest.config.ts (scoped
// to src/tests/evals/**), per that file's own header note.
import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		include: ["src/tests/unit/**/*.test.ts"],
		environment: "node",
	},
});
