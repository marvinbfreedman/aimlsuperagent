#!/usr/bin/env node
import fs from "node:fs";
import process from "node:process";

const pkg = JSON.parse(fs.readFileSync(new URL("../package.json", import.meta.url), "utf8"));

const failures = [];

if (pkg.name !== "@aimlsuperagent/agent") {
  failures.push("package name must be @aimlsuperagent/agent");
}

if (pkg.publishConfig?.access !== "public") {
  failures.push("publishConfig.access must be public");
}

if (pkg.publishConfig?.registry !== "https://registry.npmjs.org/") {
  failures.push("publishConfig.registry must be https://registry.npmjs.org/");
}

if (!pkg.bin?.["aiml-superagent"]) {
  failures.push("bin.aiml-superagent must point to the CLI entrypoint");
}

if (pkg.private === true) {
  failures.push("package.json still has private:true safety brake. Remove it only after public release approval.");
}

if (failures.length > 0) {
  console.error("Public npm publish readiness failed:");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log("Public npm publish readiness passed.");
