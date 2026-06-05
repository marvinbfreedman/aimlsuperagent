#!/usr/bin/env node
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import process from "node:process";

const REQUIRED_FILES = [
  "AGENTS.md",
  "REPO_SOURCE_OF_TRUTH.json",
  "WORKING_NOTES.md"
];

const RECOMMENDED_FILES = [
  "DEPLOYMENT_LOG.md",
  "SAFE_ENV_AUDIT.md"
];

const TEMPLATE_MAP = new Map([
  ["AGENTS.template.md", "AGENTS.md"],
  ["REPO_SOURCE_OF_TRUTH.template.json", "REPO_SOURCE_OF_TRUTH.json"],
  ["WORKING_NOTES.template.md", "WORKING_NOTES.md"],
  ["DEPLOYMENT_LOG.template.md", "DEPLOYMENT_LOG.md"],
  ["INCIDENT_REPORT.template.md", "INCIDENT_REPORT.md"],
  ["SAFE_ENV_AUDIT.template.md", "SAFE_ENV_AUDIT.md"],
  ["PRODUCTION_CHECK.template.md", "PRODUCTION_CHECK.md"],
  ["TASK_BRIEF.template.md", "TASK_BRIEF.md"]
]);

const SECRET_PATTERNS = [
  {
    name: "private-key-block",
    pattern: /-----BEGIN (RSA |EC |OPENSSH |DSA |PRIVATE )?PRIVATE KEY-----/
  },
  {
    name: "assignment-with-sensitive-name",
    pattern: /\b(api[_-]?key|secret|token|password|passwd|auth[_-]?token|private[_-]?key)\b\s*[:=]\s*["']?[A-Za-z0-9_./+=-]{16,}/i
  },
  {
    name: "database-url-with-credentials",
    pattern: /\b(postgres|postgresql|mysql|mongodb):\/\/[^:\s]+:[^@\s]+@/i
  }
];

const PLACEHOLDER_PATTERNS = [
  {
    name: "project-name-placeholder",
    pattern: /\bPROJECT_NAME\b/
  },
  {
    name: "command-placeholder",
    pattern: /\b(REPLACE_WITH_COMMAND|COMMANDS_HERE)\b/
  },
  {
    name: "date-placeholder",
    pattern: /\bYYYY-MM-DD\b/
  },
  {
    name: "generic-template-instruction",
    pattern: /Describe the project in one paragraph|One sentence describing what this project does|One sentence\./
  }
];

const CONTEXT_SIZE_LIMITS = [
  {
    file: "WORKING_NOTES.md",
    maxBytes: 80 * 1024,
    severity: "medium",
    message: "WORKING_NOTES.md is large enough to risk context bloat. Archive or compress resolved material."
  },
  {
    file: "AGENTS.md",
    maxBytes: 40 * 1024,
    severity: "medium",
    message: "AGENTS.md is large enough to weaken instruction focus. Move project history into notes."
  }
];

const DEFAULT_ANALYTICS_ENDPOINT = "https://aimlsuperagent.com/api/visitor-track";
const DEFAULT_ANALYTICS_TIMEOUT_MS = 750;
const DEFAULT_API_BASE_URL = "https://aimlsuperagent.com";
const DEFAULT_API_TIMEOUT_MS = 5000;
const API_KEY_VERIFY_PATH = "/api/superagent/keys/verify";
const CONFIG_DIR_NAME = ".aimlsuperagent";
const CONFIG_FILE_NAME = "config.json";

function usage() {
  console.log(`AiML SuperAgent

Usage:
  aiml-superagent init [target-dir]
  aiml-superagent check [target-dir] [--json] [--release] [--strict]
  aiml-superagent login <api-key>
  aiml-superagent status [--json]
  aiml-superagent logout
  aiml-superagent doctor [target-dir] [--json] [--release] [--strict]
  aiml-superagent upgrade

Analytics:
  Disabled by default. Set AIML_SUPERAGENT_ANALYTICS=1 or pass --analytics.
  Pass --no-analytics to disable analytics for one command.

Paid CLI:
  Set AIML_SUPERAGENT_API_KEY or run login with an AiML SuperAgent API key.
  Override the API base URL with AIML_SUPERAGENT_API_URL or --api-url.

Examples:
  node bin/aiml-superagent.js init ../my-app
  node bin/aiml-superagent.js check ../my-app
  node bin/aiml-superagent.js check ../my-app --release
  node bin/aiml-superagent.js check ../my-app --strict
  node bin/aiml-superagent.js login aiml_live_...
  node bin/aiml-superagent.js doctor ../my-app
`);
}

function repoRootFromScript() {
  return path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function isFrameworkPackageRepo(rootDir) {
  try {
    const packageJson = readJson(path.join(rootDir, "package.json"));
    return packageJson.name === "@aimlsuperagent/agent";
  } catch {
    return false;
  }
}

let cachedPackageVersion;

function packageVersion() {
  if (cachedPackageVersion) return cachedPackageVersion;

  try {
    const packageJson = readJson(path.join(repoRootFromScript(), "package.json"));
    cachedPackageVersion = String(packageJson.version || "0.0.0");
  } catch {
    cachedPackageVersion = "0.0.0";
  }

  return cachedPackageVersion;
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function configDir() {
  if (process.env.AIML_SUPERAGENT_CONFIG_DIR) {
    return path.resolve(process.env.AIML_SUPERAGENT_CONFIG_DIR);
  }

  return path.join(os.homedir(), CONFIG_DIR_NAME);
}

function configPath() {
  return path.join(configDir(), CONFIG_FILE_NAME);
}

function readConfig() {
  const file = configPath();
  if (!fs.existsSync(file)) return {};

  try {
    return readJson(file);
  } catch {
    return {};
  }
}

function writeConfig(config) {
  const file = configPath();
  ensureDir(path.dirname(file));
  fs.writeFileSync(file, `${JSON.stringify(config, null, 2)}\n`, { mode: 0o600 });

  try {
    fs.chmodSync(file, 0o600);
  } catch {
    // Best-effort on filesystems that do not support POSIX permissions.
  }
}

function removeConfig() {
  const file = configPath();
  if (!fs.existsSync(file)) return false;
  fs.rmSync(file, { force: true });
  return true;
}

function normalizeApiBaseUrl(value) {
  const raw = String(value || DEFAULT_API_BASE_URL).trim().replace(/\/+$/, "");
  if (!/^https?:\/\//i.test(raw)) return DEFAULT_API_BASE_URL;
  return raw;
}

function apiBaseUrl(options = {}) {
  const config = readConfig();
  return normalizeApiBaseUrl(
    options.apiBaseUrl ||
      process.env.AIML_SUPERAGENT_API_URL ||
      process.env.AIML_SUPERAGENT_BASE_URL ||
      config.apiBaseUrl ||
      DEFAULT_API_BASE_URL
  );
}

function apiTimeoutMs() {
  const parsed = Number.parseInt(String(process.env.AIML_SUPERAGENT_API_TIMEOUT_MS || ""), 10);
  if (Number.isFinite(parsed) && parsed > 0 && parsed <= 30000) return parsed;
  return DEFAULT_API_TIMEOUT_MS;
}

function maskApiKey(value) {
  const text = String(value || "");
  if (text.length <= 12) return text ? "[redacted]" : "";
  return `${text.slice(0, 8)}...${text.slice(-4)}`;
}

function maskEmail(value) {
  const text = String(value || "");
  const [name, domain] = text.split("@");
  if (!name || !domain) return text;
  return `${name.slice(0, 2)}***@${domain}`;
}

function resolveApiKey(options = {}, targetArg) {
  if (options.apiKey) {
    return { apiKey: String(options.apiKey).trim(), source: "cli" };
  }

  if (targetArg && !targetArg.startsWith("-")) {
    return { apiKey: String(targetArg).trim(), source: "argument" };
  }

  if (process.env.AIML_SUPERAGENT_API_KEY) {
    return { apiKey: String(process.env.AIML_SUPERAGENT_API_KEY).trim(), source: "env" };
  }

  const config = readConfig();
  if (config.apiKey) {
    return { apiKey: String(config.apiKey).trim(), source: "config" };
  }

  return { apiKey: null, source: "none" };
}

function verifyEndpoint(options = {}) {
  return new URL(API_KEY_VERIFY_PATH, `${apiBaseUrl(options)}/`).toString();
}

async function verifyApiKey(apiKey, options = {}) {
  if (!apiKey || typeof apiKey !== "string") {
    return { valid: false, reason: "missing-api-key", apiBaseUrl: apiBaseUrl(options) };
  }

  if (typeof globalThis.fetch !== "function") {
    return { valid: false, reason: "fetch-unavailable", apiBaseUrl: apiBaseUrl(options) };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), apiTimeoutMs());
  const endpoint = verifyEndpoint(options);

  try {
    const requestBody = {
      featureKey: options.featureKey || "license_verify",
      commandName: options.commandName || options.featureKey || "license_verify",
      packageName: "@aimlsuperagent/agent",
      packageVersion: packageVersion(),
      nodeMajor: Number.parseInt(process.versions.node.split(".")[0], 10),
      platform: process.platform,
      arch: process.arch,
      ci: isCiEnvironment(),
      metadata: compactObject({
        json: Boolean(options.json),
        release: Boolean(options.release),
        strict: Boolean(options.strict)
      })
    };

    const response = await globalThis.fetch(endpoint, {
      method: "POST",
      headers: {
        authorization: `Bearer ${apiKey}`,
        "content-type": "application/json",
        "user-agent": `aiml-superagent/${packageVersion()} node/${process.version}`
      },
      body: JSON.stringify(requestBody),
      signal: controller.signal
    });

    let responseBody = {};
    try {
      responseBody = await response.json();
    } catch {
      responseBody = {};
    }

    if (!response.ok || responseBody.valid !== true) {
      return {
        valid: false,
        reason: responseBody.reason || `http-${response.status}`,
        status: response.status,
        apiBaseUrl: apiBaseUrl(options)
      };
    }

    return {
      valid: true,
      status: response.status,
      apiBaseUrl: apiBaseUrl(options),
      keyPrefix: responseBody.keyPrefix,
      planKey: responseBody.planKey,
      customerEmail: responseBody.customerEmail,
      usageCount: responseBody.usageCount,
      lastUsedAt: responseBody.lastUsedAt,
      trackedFeatureKey: responseBody.trackedFeatureKey,
      features: Array.isArray(responseBody.features) ? responseBody.features : []
    };
  } catch (error) {
    return {
      valid: false,
      reason: error?.name === "AbortError" ? "verification-timeout" : "verification-request-failed",
      error: error instanceof Error ? error.message : String(error),
      apiBaseUrl: apiBaseUrl(options)
    };
  } finally {
    clearTimeout(timeout);
  }
}

async function licenseStatus(options = {}, targetArg) {
  const resolved = resolveApiKey(options, targetArg);

  if (!resolved.apiKey) {
    return {
      mode: "free",
      valid: false,
      reason: "missing-api-key",
      source: "none",
      apiBaseUrl: apiBaseUrl(options),
      configPath: configPath()
    };
  }

  const verification = await verifyApiKey(resolved.apiKey, options);
  const { customerEmail, ...safeVerification } = verification;

  return {
    mode: safeVerification.valid ? "paid" : "unverified",
    source: resolved.source,
    maskedKey: maskApiKey(resolved.apiKey),
    configPath: configPath(),
    ...safeVerification,
    customerEmailMasked: customerEmail ? maskEmail(customerEmail) : undefined
  };
}

function printLicenseStatus(status, jsonMode) {
  if (jsonMode) {
    console.log(JSON.stringify(status, null, 2));
    return;
  }

  console.log("AiML SuperAgent license");
  console.log(`Mode: ${status.mode}`);
  console.log(`API: ${status.apiBaseUrl}`);
  console.log(`Source: ${status.source}`);

  if (status.maskedKey) {
    console.log(`Key: ${status.maskedKey}`);
  }

  if (status.valid) {
    console.log("Status: active");
    console.log(`Plan: ${status.planKey || "active"}`);
    if (status.customerEmailMasked) console.log(`Customer: ${status.customerEmailMasked}`);
    if (status.keyPrefix) console.log(`Key prefix: ${status.keyPrefix}`);
    if (status.usageCount !== undefined) console.log(`Usage count: ${status.usageCount}`);
    if (status.lastUsedAt) console.log(`Last verified: ${status.lastUsedAt}`);
    if (Array.isArray(status.features) && status.features.length > 0) {
      console.log(`Features: ${status.features.join(", ")}`);
    }
    return;
  }

  if (status.mode === "free") {
    console.log("Status: no API key configured");
    console.log("Free commands: init, check");
    console.log("Paid commands: doctor");
    console.log("Run `aiml-superagent upgrade` to get an API key.");
    return;
  }

  console.log(`Status: invalid (${status.reason || "unknown"})`);
}

function printDoctor(result, license, jsonMode) {
  const readiness = score(result.findings);
  const payload = {
    rootDir: result.rootDir,
    readiness,
    license,
    paidFeatures: {
      doctor: license.valid === true,
      remoteVerification: license.valid === true
    },
    findings: result.findings
  };

  if (jsonMode) {
    console.log(JSON.stringify(payload, null, 2));
    return;
  }

  console.log(`AiML SuperAgent doctor: ${result.rootDir}`);
  console.log(`Project readiness: ${readiness.label}`);
  console.log(`Findings: high=${readiness.high} medium=${readiness.medium} low=${readiness.low}`);
  console.log(`License: ${license.valid ? `active (${license.planKey || "paid"})` : `invalid (${license.reason || "unknown"})`}`);

  if (result.findings.length === 0) {
    console.log("No project findings.");
  } else {
    for (const item of result.findings) {
      console.log(`- [${item.severity}] ${item.file}: ${item.message}`);
    }
  }
}

function copyTemplates(targetDir) {
  const root = repoRootFromScript();
  const templateDir = path.join(root, "templates");
  const actions = [];

  ensureDir(targetDir);

  for (const [templateName, outputName] of TEMPLATE_MAP.entries()) {
    const source = path.join(templateDir, templateName);
    const target = path.join(targetDir, outputName);

    if (!fs.existsSync(source)) {
      actions.push({ type: "missing-template", file: templateName });
      continue;
    }

    if (fs.existsSync(target)) {
      actions.push({ type: "skipped-existing", file: outputName });
      continue;
    }

    fs.copyFileSync(source, target);
    actions.push({ type: "created", file: outputName });
  }

  return actions;
}

function isIgnoredForPlaceholderScan(relPath) {
  return (
    relPath === "bin/aiml-superagent.js" ||
    relPath.startsWith("templates/") ||
    relPath.startsWith("schemas/")
  );
}

function listTextFiles(rootDir) {
  const skip = new Set([".git", "node_modules", ".next", "dist", "build", "coverage"]);
  const files = [];

  function walk(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (skip.has(entry.name)) continue;
      const fullPath = path.join(dir, entry.name);
      const relPath = path.relative(rootDir, fullPath);

      if (entry.isDirectory()) {
        walk(fullPath);
        continue;
      }

      if (entry.isFile() && /\.(md|json|js|ts|tsx|yml|yaml|env|txt)$/i.test(entry.name)) {
        files.push(relPath);
      }
    }
  }

  walk(rootDir);
  return files;
}

function scanForSecrets(rootDir) {
  const findings = [];
  for (const relPath of listTextFiles(rootDir)) {
    const fullPath = path.join(rootDir, relPath);
    const content = fs.readFileSync(fullPath, "utf8");

    for (const rule of SECRET_PATTERNS) {
      if (rule.pattern.test(content)) {
        findings.push({
          severity: "high",
          rule: rule.name,
          file: relPath,
          message: "Possible secret value found. Store names and roles only, never credential values."
        });
      }
    }
  }

  return findings;
}

function scanForPlaceholders(rootDir) {
  const findings = [];
  for (const relPath of listTextFiles(rootDir)) {
    if (isIgnoredForPlaceholderScan(relPath)) continue;

    const fullPath = path.join(rootDir, relPath);
    const content = fs.readFileSync(fullPath, "utf8");

    for (const rule of PLACEHOLDER_PATTERNS) {
      if (rule.pattern.test(content)) {
        findings.push({
          severity: "medium",
          rule: rule.name,
          file: relPath,
          message: "Template placeholder appears to be unresolved."
        });
        break;
      }
    }
  }

  return findings;
}

function validateContextSize(rootDir) {
  const findings = [];

  for (const rule of CONTEXT_SIZE_LIMITS) {
    const file = path.join(rootDir, rule.file);
    if (!fs.existsSync(file)) continue;

    const size = fs.statSync(file).size;
    if (size > rule.maxBytes) {
      findings.push({
        severity: rule.severity,
        file: rule.file,
        message: `${rule.message} Current size: ${size} bytes.`
      });
    }
  }

  return findings;
}

function validateRelativePath(rootDir, relPath) {
  if (typeof relPath !== "string" || relPath.trim() === "") return false;
  if (/^https?:\/\//i.test(relPath)) return true;
  return fs.existsSync(path.join(rootDir, relPath));
}

function validateSourceOfTruth(rootDir) {
  const findings = [];
  const file = path.join(rootDir, "REPO_SOURCE_OF_TRUTH.json");

  if (!fs.existsSync(file)) {
    findings.push({
      severity: "high",
      file: "REPO_SOURCE_OF_TRUTH.json",
      message: "Missing source-of-truth file."
    });
    return findings;
  }

  let data;
  try {
    data = readJson(file);
  } catch (error) {
    findings.push({
      severity: "high",
      file: "REPO_SOURCE_OF_TRUTH.json",
      message: `Invalid JSON: ${error.message}`
    });
    return findings;
  }

  if (!data.project?.name) {
    findings.push({
      severity: "medium",
      file: "REPO_SOURCE_OF_TRUTH.json",
      message: "Missing project.name."
    });
  }

  if (data.sourceOfTruth && typeof data.sourceOfTruth === "object") {
    for (const [key, relPath] of Object.entries(data.sourceOfTruth)) {
      if (!validateRelativePath(rootDir, relPath)) {
        findings.push({
          severity: "medium",
          file: "REPO_SOURCE_OF_TRUTH.json",
          message: `sourceOfTruth.${key} points to a missing path: ${relPath}`
        });
      }
    }
  }

  if (!Array.isArray(data.contextMinimizer?.readFirst) || data.contextMinimizer.readFirst.length === 0) {
    findings.push({
      severity: "medium",
      file: "REPO_SOURCE_OF_TRUTH.json",
      message: "contextMinimizer.readFirst should list the files an agent reads first."
    });
  }

  if (Array.isArray(data.contextMinimizer?.readFirst)) {
    for (const relPath of data.contextMinimizer.readFirst) {
      if (!validateRelativePath(rootDir, relPath)) {
        findings.push({
          severity: "high",
          file: "REPO_SOURCE_OF_TRUTH.json",
          message: `contextMinimizer.readFirst points to a missing path: ${relPath}`
        });
      }
    }
  }

  if (!Array.isArray(data.contextMinimizer?.doNotLoadByDefault) || data.contextMinimizer.doNotLoadByDefault.length < 5) {
    findings.push({
      severity: "medium",
      file: "REPO_SOURCE_OF_TRUTH.json",
      message: "contextMinimizer.doNotLoadByDefault should protect active context from generated or stale folders."
    });
  }

  if (!data.secrets?.policy) {
    findings.push({
      severity: "medium",
      file: "REPO_SOURCE_OF_TRUTH.json",
      message: "Missing secrets.policy."
    });
  }

  if (!Array.isArray(data.verification?.defaultCommands) || data.verification.defaultCommands.length === 0) {
    findings.push({
      severity: "medium",
      file: "REPO_SOURCE_OF_TRUTH.json",
      message: "verification.defaultCommands should list the fastest meaningful proof command."
    });
  }

  return findings;
}

function checkProject(targetDir, options = {}) {
  const rootDir = path.resolve(targetDir);
  const findings = [];

  if (!fs.existsSync(rootDir)) {
    findings.push({
      severity: "high",
      file: rootDir,
      message: "Target directory does not exist."
    });
    return { rootDir, findings };
  }

  for (const file of REQUIRED_FILES) {
    if (!fs.existsSync(path.join(rootDir, file))) {
      findings.push({
        severity: "high",
        file,
        message: "Required SuperAgent operating file is missing."
      });
    }
  }

  const recommendedFiles = isFrameworkPackageRepo(rootDir)
    ? RECOMMENDED_FILES.filter((file) => file !== "DEPLOYMENT_LOG.md")
    : RECOMMENDED_FILES;

  for (const file of recommendedFiles) {
    if (!fs.existsSync(path.join(rootDir, file))) {
      findings.push({
        severity: "low",
        file,
        message: "Recommended for production projects."
      });
    }
  }

  findings.push(...validateSourceOfTruth(rootDir));
  findings.push(...scanForSecrets(rootDir));
  findings.push(...scanForPlaceholders(rootDir));
  findings.push(...validateContextSize(rootDir));

  if (options.release) {
    if (!fs.existsSync(path.join(rootDir, "SECURITY.md"))) {
      findings.push({
        severity: "medium",
        file: "SECURITY.md",
        message: "Recommended before making the repository public."
      });
    }

    if (!fs.existsSync(path.join(rootDir, "CONTRIBUTING.md"))) {
      findings.push({
        severity: "low",
        file: "CONTRIBUTING.md",
        message: "Recommended before making the repository public."
      });
    }

    if (!fs.existsSync(path.join(rootDir, "LICENSE"))) {
      findings.push({
        severity: "medium",
        file: "LICENSE",
        message: "No license file found. Choose public terms before release."
      });
    }
  }

  return { rootDir, findings };
}

function score(findings) {
  const high = findings.filter((item) => item.severity === "high").length;
  const medium = findings.filter((item) => item.severity === "medium").length;
  const low = findings.filter((item) => item.severity === "low").length;

  if (high > 0) return { label: "not-ready", high, medium, low };
  if (medium > 0) return { label: "needs-review", high, medium, low };
  return { label: "ready", high, medium, low };
}

function printCheck(result, jsonMode) {
  const readiness = score(result.findings);

  if (jsonMode) {
    console.log(JSON.stringify({ ...result, readiness }, null, 2));
    return;
  }

  console.log(`AiML SuperAgent check: ${result.rootDir}`);
  console.log(`Readiness: ${readiness.label}`);
  console.log(`Findings: high=${readiness.high} medium=${readiness.medium} low=${readiness.low}`);

  if (result.findings.length === 0) {
    console.log("No findings.");
    return;
  }

  for (const item of result.findings) {
    console.log(`- [${item.severity}] ${item.file}: ${item.message}`);
  }
}

function parseArgs(argv) {
  const args = [...argv];
  const options = {
    json: false,
    release: false,
    strict: false,
    analytics: null,
    apiKey: null,
    apiBaseUrl: null
  };
  const positionals = [];

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (arg === "--json") {
      options.json = true;
    } else if (arg === "--release") {
      options.release = true;
    } else if (arg === "--strict") {
      options.strict = true;
    } else if (arg === "--analytics") {
      options.analytics = true;
    } else if (arg === "--no-analytics") {
      options.analytics = false;
    } else if (arg === "--key") {
      options.apiKey = args[index + 1] || "";
      index += 1;
    } else if (arg.startsWith("--key=")) {
      options.apiKey = arg.slice("--key=".length);
    } else if (arg === "--api-url" || arg === "--api-base-url") {
      options.apiBaseUrl = args[index + 1] || "";
      index += 1;
    } else if (arg.startsWith("--api-url=")) {
      options.apiBaseUrl = arg.slice("--api-url=".length);
    } else if (arg.startsWith("--api-base-url=")) {
      options.apiBaseUrl = arg.slice("--api-base-url=".length);
    } else {
      positionals.push(arg);
    }
  }

  return { command: positionals[0], targetArg: positionals[1], options };
}

function isTruthy(value) {
  return /^(1|true|yes|on)$/i.test(String(value || "").trim());
}

function analyticsEnabled(options) {
  if (options.analytics === true) return true;
  if (options.analytics === false) return false;
  return isTruthy(process.env.AIML_SUPERAGENT_ANALYTICS);
}

function analyticsEndpoint() {
  const endpoint = String(process.env.AIML_SUPERAGENT_ANALYTICS_ENDPOINT || DEFAULT_ANALYTICS_ENDPOINT).trim();
  return /^https?:\/\//i.test(endpoint) ? endpoint : null;
}

function analyticsTimeoutMs() {
  const parsed = Number.parseInt(String(process.env.AIML_SUPERAGENT_ANALYTICS_TIMEOUT_MS || ""), 10);
  if (Number.isFinite(parsed) && parsed > 0 && parsed <= 5000) return parsed;
  return DEFAULT_ANALYTICS_TIMEOUT_MS;
}

function compactObject(object) {
  return Object.fromEntries(
    Object.entries(object).filter(([, value]) => value !== undefined && value !== null)
  );
}

function isCiEnvironment() {
  return Boolean(
    process.env.CI ||
      process.env.GITHUB_ACTIONS ||
      process.env.GITLAB_CI ||
      process.env.CIRCLECI ||
      process.env.VERCEL ||
      process.env.NETLIFY
  );
}

function actionCounts(actions) {
  const counts = {};

  for (const action of actions) {
    counts[action.type] = (counts[action.type] || 0) + 1;
  }

  return counts;
}

async function recordCliAnalytics(options, event) {
  if (!analyticsEnabled(options) || typeof globalThis.fetch !== "function") return;

  const endpoint = analyticsEndpoint();
  if (!endpoint) return;

  const command = event.command || "unknown";
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), analyticsTimeoutMs());

  const body = {
    eventName: "package_cli_command",
    siteName: "aimlsuperagent-package",
    path: `/cli/${command}`,
    title: "AiML SuperAgent CLI",
    data: compactObject({
      packageName: "@aimlsuperagent/agent",
      packageVersion: packageVersion(),
      command,
      result: event.exitCode === 0 ? "success" : "failure",
      exitCode: event.exitCode,
      durationMs: event.durationMs,
      nodeMajor: Number.parseInt(process.versions.node.split(".")[0], 10),
      platform: process.platform,
      arch: process.arch,
      ci: isCiEnvironment(),
      json: Boolean(options.json),
      release: Boolean(options.release),
      strict: Boolean(options.strict),
      readiness: event.readiness?.label,
      highFindings: event.readiness?.high,
      mediumFindings: event.readiness?.medium,
      lowFindings: event.readiness?.low,
      actionCounts: event.actionCounts
    })
  };

  try {
    await globalThis.fetch(endpoint, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "user-agent": `aiml-superagent/${packageVersion()} node/${process.version}`
      },
      body: JSON.stringify(body),
      signal: controller.signal
    });
  } catch {
    // Analytics is best-effort and must never affect CLI behavior.
  } finally {
    clearTimeout(timeout);
  }
}

async function main() {
  const startedAt = Date.now();
  const { command, targetArg, options } = parseArgs(process.argv.slice(2));

  if (!command || command === "--help" || command === "-h") {
    usage();
    const exitCode = 0;
    await recordCliAnalytics(options, {
      command: "help",
      exitCode,
      durationMs: Date.now() - startedAt
    });
    return exitCode;
  }

  if (command === "init") {
    const targetDir = path.resolve(targetArg || ".");
    const actions = copyTemplates(targetDir);
    for (const action of actions) {
      console.log(`${action.type}: ${action.file}`);
    }
    console.log("commit-safety: run `npx @aimlsuperagent/agent check .` before committing generated notes, and store names/roles only, never secret values.");
    const exitCode = 0;
    await recordCliAnalytics(options, {
      command,
      exitCode,
      durationMs: Date.now() - startedAt,
      actionCounts: actionCounts(actions)
    });
    return exitCode;
  }

  if (command === "check") {
    const targetDir = path.resolve(targetArg || ".");
    const result = checkProject(targetDir, options);
    const readiness = score(result.findings);
    printCheck(result, options.json);
    const exitCode = readiness.high > 0 || (options.strict && readiness.medium > 0) ? 1 : 0;
    await recordCliAnalytics(options, {
      command,
      exitCode,
      durationMs: Date.now() - startedAt,
      readiness
    });
    return exitCode;
  }

  if (command === "login") {
    const resolved = resolveApiKey(options, targetArg);

    if (!resolved.apiKey) {
      console.error("Missing API key. Pass `aiml-superagent login <api-key>` or set AIML_SUPERAGENT_API_KEY.");
      const exitCode = 1;
      await recordCliAnalytics(options, {
        command,
        exitCode,
        durationMs: Date.now() - startedAt
      });
      return exitCode;
    }

    const verification = await verifyApiKey(resolved.apiKey, {
      ...options,
      featureKey: "license_login",
      commandName: "login"
    });

    if (!verification.valid) {
      console.error(`License verification failed: ${verification.reason || "unknown"}`);
      const exitCode = 1;
      await recordCliAnalytics(options, {
        command,
        exitCode,
        durationMs: Date.now() - startedAt
      });
      return exitCode;
    }

    writeConfig({
      apiKey: resolved.apiKey,
      apiBaseUrl: verification.apiBaseUrl,
      keyPrefix: verification.keyPrefix,
      planKey: verification.planKey,
      verifiedAt: new Date().toISOString(),
      packageName: "@aimlsuperagent/agent",
      packageVersion: packageVersion()
    });

    console.log("AiML SuperAgent license saved.");
    console.log(`Config: ${configPath()}`);
    console.log(`Plan: ${verification.planKey || "active"}`);
    if (verification.keyPrefix) console.log(`Key prefix: ${verification.keyPrefix}`);
    if (verification.customerEmail) console.log(`Customer: ${maskEmail(verification.customerEmail)}`);

    const exitCode = 0;
    await recordCliAnalytics(options, {
      command,
      exitCode,
      durationMs: Date.now() - startedAt
    });
    return exitCode;
  }

  if (command === "logout") {
    const removed = removeConfig();
    console.log(removed ? "AiML SuperAgent license removed." : "No AiML SuperAgent license config found.");
    const exitCode = 0;
    await recordCliAnalytics(options, {
      command,
      exitCode,
      durationMs: Date.now() - startedAt
    });
    return exitCode;
  }

  if (command === "status" || command === "license" || command === "whoami") {
    const status = await licenseStatus({
      ...options,
      featureKey: "license_status",
      commandName: "status"
    });
    printLicenseStatus(status, options.json);
    const exitCode = status.mode === "unverified" ? 1 : 0;
    await recordCliAnalytics(options, {
      command: "status",
      exitCode,
      durationMs: Date.now() - startedAt
    });
    return exitCode;
  }

  if (command === "upgrade") {
    if (options.json) {
      console.log(
        JSON.stringify(
          {
            pricingUrl: "https://aimlsuperagent.com/#pricing",
            accountUrl: "https://aimlsuperagent.com/",
            apiKeyHelp: "Subscribe, create an API key, then run `aiml-superagent login <api-key>`."
          },
          null,
          2
        )
      );
    } else {
      console.log("AiML SuperAgent paid CLI");
      console.log("Pricing: https://aimlsuperagent.com/#pricing");
      console.log("After subscribing, create an API key and run:");
      console.log("  aiml-superagent login <api-key>");
    }

    const exitCode = 0;
    await recordCliAnalytics(options, {
      command,
      exitCode,
      durationMs: Date.now() - startedAt
    });
    return exitCode;
  }

  if (command === "doctor") {
    const license = await licenseStatus({
      ...options,
      featureKey: "doctor",
      commandName: "doctor"
    });

    if (!license.valid) {
      if (options.json) {
        console.log(
          JSON.stringify(
            {
              error: "paid-license-required",
              license
            },
            null,
            2
          )
        );
      } else {
        console.error("AiML SuperAgent doctor requires an active paid API key.");
        printLicenseStatus(license, false);
        console.error("Run `aiml-superagent upgrade` to subscribe or `aiml-superagent login <api-key>` if you already have a key.");
      }

      const exitCode = 1;
      await recordCliAnalytics(options, {
        command,
        exitCode,
        durationMs: Date.now() - startedAt
      });
      return exitCode;
    }

    const targetDir = path.resolve(targetArg || ".");
    const result = checkProject(targetDir, options);
    const readiness = score(result.findings);
    printDoctor(result, license, options.json);
    const exitCode = readiness.high > 0 || (options.strict && readiness.medium > 0) ? 1 : 0;
    await recordCliAnalytics(options, {
      command,
      exitCode,
      durationMs: Date.now() - startedAt,
      readiness
    });
    return exitCode;
  }

  console.error(`Unknown command: ${command}`);
  usage();
  const exitCode = 1;
  await recordCliAnalytics(options, {
    command: "unknown",
    exitCode,
    durationMs: Date.now() - startedAt
  });
  return exitCode;
}

main()
  .then((exitCode) => {
    process.exit(exitCode);
  })
  .catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
