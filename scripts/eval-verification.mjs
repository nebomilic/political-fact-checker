#!/usr/bin/env node
// scripts/eval-verification.mjs
//
// CLI wrapper around `vitest run` for the verification eval. Vitest itself
// rejects unrecognized CLI flags, so --provider/--compare (CLAUDE.md) are
// parsed here and forwarded to the spec via env vars instead.
//
// Usage:
//   npm run eval:verification                       # OpenAI (default)
//   npm run eval:verification -- --provider mistral
//   npm run eval:verification -- --compare           # both, side by side

import { spawn } from "node:child_process";

const args = process.argv.slice(2);

let provider = "openai";
let compare = false;

for (let i = 0; i < args.length; i++) {
	const arg = args[i];
	if (arg === "--compare") {
		compare = true;
	} else if (arg === "--provider") {
		provider = args[++i];
	} else if (arg.startsWith("--provider=")) {
		provider = arg.slice("--provider=".length);
	} else {
		console.error(`Unknown argument: ${arg}`);
		console.error(
			"Usage: npm run eval:verification -- [--provider openai|mistral] [--compare]",
		);
		process.exit(1);
	}
}

if (!compare && provider !== "openai" && provider !== "mistral") {
	console.error(
		`Invalid --provider value: "${provider}" (expected "openai" or "mistral")`,
	);
	process.exit(1);
}

if (compare && args.includes("--provider")) {
	console.error("Note: --compare runs both providers; ignoring --provider.");
}

const env = {
	...process.env,
	EVAL_VERIFICATION_PROVIDER: provider,
	EVAL_VERIFICATION_COMPARE: compare ? "1" : "",
};

const child = spawn(
	"vitest",
	[
		"run",
		"--config",
		"vitest.config.ts",
		"src/tests/evals/claim-verification.eval.ts",
	],
	{ stdio: "inherit", env },
);

child.on("exit", (code) => {
	process.exit(code ?? 1);
});
