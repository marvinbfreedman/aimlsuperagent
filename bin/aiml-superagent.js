#!/usr/bin/env node
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { spawn } from "node:child_process";

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
const PROJECT_SYNC_PATH = "/api/superagent/projects/sync";
const MEMORY_EVENTS_PATH = "/api/superagent/memory/events";
const CONFIG_DIR_NAME = ".aimlsuperagent";
const CONFIG_FILE_NAME = "config.json";
const SIGNIN_PROVIDERS = new Set(["google", "github"]);
const SIGNIN_PLAN_KEYS = new Set(["core", "pro"]);
const SIGNIN_BILLING_PERIODS = new Set(["monthly", "yearly"]);

function usage() {
  console.log(`AiML SuperAgent

Usage:
  aiml-superagent init [target-dir]
  aiml-superagent check [target-dir] [--json] [--release] [--strict]
  aiml-superagent signin [--provider google|github] [--plan core|pro] [--billing monthly|yearly] [--no-browser] [--json]
  aiml-superagent signin-check [--json]
  aiml-superagent login <api-key>
  aiml-superagent status [--json]
  aiml-superagent logout
  aiml-superagent doctor [target-dir] [--deep] [--json] [--release] [--strict]
  aiml-superagent env-audit [target-dir] [--json]
  aiml-superagent context-report [target-dir] [--json]
  aiml-superagent ci [target-dir] [--json]
  aiml-superagent incident "summary" [--output path]
  aiml-superagent handoff [target-dir] [--output path]
  aiml-superagent deploy-proof [target-dir] [--output path] [--json]
  aiml-superagent sync [target-dir] [--json] [--include-remote]
  aiml-superagent memory [target-dir] --kind command|failure|deployment|decision|rag-eval --title "..." [--summary "..."] [--json]
  aiml-superagent usage [--json]
  aiml-superagent upgrade [--feature name]

Analytics:
  Disabled by default. Set AIML_SUPERAGENT_ANALYTICS=1 or pass --analytics.
  Pass --no-analytics to disable analytics for one command.

Paid CLI:
  Set AIML_SUPERAGENT_API_KEY or run login with an AiML SuperAgent API key.
  Run signin to open the browser account flow, then login with the issued key.
  Override the API base URL with AIML_SUPERAGENT_API_URL or --api-url.

Examples:
  node bin/aiml-superagent.js init ../my-app
  node bin/aiml-superagent.js check ../my-app
  node bin/aiml-superagent.js check ../my-app --release
  node bin/aiml-superagent.js check ../my-app --strict
  node bin/aiml-superagent.js signin --provider google --plan core
  node bin/aiml-superagent.js signin-check
  node bin/aiml-superagent.js login aiml_live_...
  node bin/aiml-superagent.js doctor ../my-app
  node bin/aiml-superagent.js env-audit ../my-app
  node bin/aiml-superagent.js context-report ../my-app
  node bin/aiml-superagent.js handoff ../my-app
  node bin/aiml-superagent.js memory . --kind command --title "Build passed" --command-text "npm run build" --status success
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

function projectSyncEndpoint(options = {}) {
  return new URL(PROJECT_SYNC_PATH, `${apiBaseUrl(options)}/`).toString();
}

function memoryEventsEndpoint(options = {}) {
  return new URL(MEMORY_EVENTS_PATH, `${apiBaseUrl(options)}/`).toString();
}

function normalizeSigninProvider(value) {
  const provider = String(value || "").trim().toLowerCase();
  return SIGNIN_PROVIDERS.has(provider) ? provider : null;
}

function normalizeSigninPlan(value) {
  const plan = String(value || "").trim().toLowerCase();
  return SIGNIN_PLAN_KEYS.has(plan) ? plan : null;
}

function normalizeSigninBilling(value) {
  const billing = String(value || "").trim().toLowerCase();
  return SIGNIN_BILLING_PERIODS.has(billing) ? billing : "monthly";
}

function invalidSigninOption(options) {
  if (options.provider && !normalizeSigninProvider(options.provider)) {
    return {
      option: "provider",
      message: "Invalid provider. Use google or github."
    };
  }

  if (options.plan && !normalizeSigninPlan(options.plan)) {
    return {
      option: "plan",
      message: "Invalid plan. Use core or pro."
    };
  }

  if (options.billing && !SIGNIN_BILLING_PERIODS.has(String(options.billing).trim().toLowerCase())) {
    return {
      option: "billing",
      message: "Invalid billing period. Use monthly or yearly."
    };
  }

  return null;
}

function accountSigninUrl(options = {}) {
  const base = `${apiBaseUrl(options)}/`;
  const provider = normalizeSigninProvider(options.provider);
  const plan = normalizeSigninPlan(options.plan);
  const billing = normalizeSigninBilling(options.billing);
  const pathName = provider && plan ? `/api/auth/${provider}/start` : "/signup";
  const url = new URL(pathName, base);

  if (plan) url.searchParams.set("plan", plan);
  if (billing) url.searchParams.set("billing", billing);
  if (provider && !plan) url.searchParams.set("auth_hint", provider);
  url.searchParams.set("source", "cli");

  return {
    url: url.toString(),
    provider,
    planKey: plan,
    billingPeriod: billing
  };
}

function shouldOpenBrowser(options = {}) {
  if (options.browser === true) return true;
  if (options.browser === false) return false;
  return !isCiEnvironment();
}

function openBrowserUrl(url) {
  try {
    const platform = process.platform;
    const command = platform === "darwin" ? "open" : platform === "win32" ? "cmd" : "xdg-open";
    const args = platform === "win32" ? ["/c", "start", "", url] : [url];
    const child = spawn(command, args, {
      detached: true,
      stdio: "ignore"
    });
    child.on("error", () => {
      // Browser opening is best-effort and must not break the sign-in flow.
    });
    child.unref();
    return { opened: true };
  } catch (error) {
    return {
      opened: false,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

function savePendingBrowserSignin(pending) {
  const config = readConfig();
  writeConfig({
    ...config,
    browserSignin: pending
  });
}

function pendingBrowserSignin() {
  const pending = readConfig().browserSignin;
  if (!pending || typeof pending !== "object") return null;
  if (!pending.url || !pending.startedAt) return null;
  return pending;
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

async function requirePaidLicense(options, featureKey, commandName) {
  const license = await licenseStatus({
    ...options,
    featureKey,
    commandName
  });

  if (license.valid) {
    return { ok: true, license };
  }

  return { ok: false, license };
}

function printPaidRequired(commandName, license, jsonMode) {
  if (jsonMode) {
    console.log(
      JSON.stringify(
        {
          error: "paid-license-required",
          command: commandName,
          license
        },
        null,
        2
      )
    );
    return;
  }

  console.error(`AiML SuperAgent ${commandName} requires an active paid API key.`);
  printLicenseStatus(license, false);
  console.error(`Run \`aiml-superagent upgrade --feature ${commandName}\` to subscribe or \`aiml-superagent login <api-key>\` if you already have a key.`);
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
      if (/^\.aimlsuperagent-ultraspeed.*\.json$/i.test(entry.name) || /^ULTRASPEED.*\.json$/i.test(entry.name)) {
        continue;
      }

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

function safeReadJson(file) {
  try {
    return readJson(file);
  } catch {
    return null;
  }
}

function getProjectSourceOfTruth(rootDir) {
  return safeReadJson(path.join(rootDir, "REPO_SOURCE_OF_TRUTH.json")) || {};
}

function getPackageJson(rootDir) {
  return safeReadJson(path.join(rootDir, "package.json")) || {};
}

function classifyTextFile(relPath) {
  const lower = relPath.toLowerCase();
  if (lower === "agents.md" || lower === "repo_source_of_truth.json" || lower === "working_notes.md") return "read-first";
  if (lower.includes("deployment") || lower.includes("incident") || lower.includes("safe_env")) return "read-when-relevant";
  if (lower.endsWith(".env") || lower.includes(".env.")) return "env-names-only";
  if (lower.includes("package.json") || lower.includes("next.config") || lower.includes("vercel.json")) return "config";
  return "search-only";
}

function contextReport(targetDir) {
  const rootDir = path.resolve(targetDir);
  const files = fs.existsSync(rootDir)
    ? listTextFiles(rootDir).map((relPath) => {
        const sizeBytes = fs.statSync(path.join(rootDir, relPath)).size;
        return {
          file: relPath,
          sizeBytes,
          classification: classifyTextFile(relPath)
        };
      })
    : [];

  const totalBytes = files.reduce((sum, file) => sum + file.sizeBytes, 0);
  const largest = [...files].sort((a, b) => b.sizeBytes - a.sizeBytes).slice(0, 12);
  const oversized = files.filter((file) => {
    if (file.file === "WORKING_NOTES.md") return file.sizeBytes > 80 * 1024;
    if (file.file === "AGENTS.md") return file.sizeBytes > 40 * 1024;
    return file.sizeBytes > 120 * 1024;
  });

  const byClassification = {};
  for (const file of files) {
    byClassification[file.classification] = (byClassification[file.classification] || 0) + 1;
  }

  const recommendations = [];
  if (oversized.length > 0) {
    recommendations.push("Archive, summarize, or split oversized context files before asking an agent to load them.");
  }
  if (!files.some((file) => file.file === "REPO_SOURCE_OF_TRUTH.json")) {
    recommendations.push("Add REPO_SOURCE_OF_TRUTH.json so agents start from stable project facts.");
  }
  if (!files.some((file) => file.file === "WORKING_NOTES.md")) {
    recommendations.push("Add WORKING_NOTES.md for durable facts and resolved context.");
  }
  recommendations.push("Use targeted search for search-only files instead of loading broad directories.");

  return {
    rootDir,
    fileCount: files.length,
    totalBytes,
    estimatedTokens: Math.ceil(totalBytes / 4),
    byClassification,
    largest,
    oversized,
    recommendations
  };
}

function printContextReport(report, jsonMode) {
  if (jsonMode) {
    console.log(JSON.stringify(report, null, 2));
    return;
  }

  console.log(`AiML SuperAgent context report: ${report.rootDir}`);
  console.log(`Text files: ${report.fileCount}`);
  console.log(`Estimated active-token risk if loaded all: ${report.estimatedTokens}`);
  console.log("Classifications:");
  for (const [name, count] of Object.entries(report.byClassification)) {
    console.log(`- ${name}: ${count}`);
  }
  console.log("Largest files:");
  for (const file of report.largest.slice(0, 8)) {
    console.log(`- ${file.file}: ${file.sizeBytes} bytes (${file.classification})`);
  }
  if (report.oversized.length > 0) {
    console.log("Oversized context risks:");
    for (const file of report.oversized) {
      console.log(`- ${file.file}: ${file.sizeBytes} bytes`);
    }
  }
  console.log("Recommendations:");
  for (const item of report.recommendations) {
    console.log(`- ${item}`);
  }
}

function parseEnvNamesFromFile(file) {
  if (!fs.existsSync(file)) return [];
  const names = new Set();
  const lines = fs.readFileSync(file, "utf8").split(/\r?\n/);

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || trimmed.startsWith("export #")) continue;
    const match = trimmed.match(/^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=/);
    if (match) names.add(match[1]);
  }

  return [...names].sort();
}

function envAudit(targetDir) {
  const rootDir = path.resolve(targetDir);
  const candidateFiles = [
    ".env.example",
    ".env",
    ".env.local",
    ".env.development",
    ".env.production",
    ".env.preview"
  ];
  const sources = candidateFiles
    .map((file) => ({
      file,
      exists: fs.existsSync(path.join(rootDir, file)),
      names: parseEnvNamesFromFile(path.join(rootDir, file))
    }))
    .filter((source) => source.exists);

  const example = sources.find((source) => source.file === ".env.example")?.names || [];
  const localNames = new Set(
    sources
      .filter((source) => source.file !== ".env.example")
      .flatMap((source) => source.names)
  );
  const allNames = new Set(sources.flatMap((source) => source.names));
  const duplicateNames = [...allNames]
    .map((name) => ({
      name,
      files: sources.filter((source) => source.names.includes(name)).map((source) => source.file)
    }))
    .filter((item) => item.files.length > 1);

  const missingLocalFromExample = example.filter((name) => !localNames.has(name));
  const localNotInExample = [...localNames].filter((name) => !example.includes(name)).sort();

  return {
    rootDir,
    sources,
    summary: {
      sourceCount: sources.length,
      uniqueNameCount: allNames.size,
      missingLocalFromExampleCount: missingLocalFromExample.length,
      localNotInExampleCount: localNotInExample.length,
      duplicateNameCount: duplicateNames.length
    },
    missingLocalFromExample,
    localNotInExample,
    duplicateNames,
    safety: "Names only. Values are not printed, stored, or synced."
  };
}

function printEnvAudit(audit, jsonMode) {
  if (jsonMode) {
    console.log(JSON.stringify(audit, null, 2));
    return;
  }

  console.log(`AiML SuperAgent env audit: ${audit.rootDir}`);
  console.log(audit.safety);
  console.log(`Env sources: ${audit.summary.sourceCount}`);
  for (const source of audit.sources) {
    console.log(`- ${source.file}: ${source.names.length} names`);
  }
  console.log(`Missing locally from .env.example: ${audit.summary.missingLocalFromExampleCount}`);
  for (const name of audit.missingLocalFromExample.slice(0, 20)) console.log(`- ${name}`);
  console.log(`Local names not in .env.example: ${audit.summary.localNotInExampleCount}`);
  for (const name of audit.localNotInExample.slice(0, 20)) console.log(`- ${name}`);
  console.log(`Duplicate names across files: ${audit.summary.duplicateNameCount}`);
  for (const item of audit.duplicateNames.slice(0, 20)) console.log(`- ${item.name}: ${item.files.join(", ")}`);
}

function gitHead(rootDir) {
  const gitDir = path.join(rootDir, ".git");
  const headFile = path.join(gitDir, "HEAD");
  if (!fs.existsSync(headFile)) return { hasGit: false };

  const head = fs.readFileSync(headFile, "utf8").trim();
  if (head.startsWith("ref: ")) {
    const ref = head.slice(5);
    const branch = ref.replace(/^refs\/heads\//, "");
    const refFile = path.join(gitDir, ref);
    const commit = fs.existsSync(refFile) ? fs.readFileSync(refFile, "utf8").trim() : null;
    return { hasGit: true, branch, commit };
  }

  return { hasGit: true, branch: "detached", commit: head || null };
}

function gitRemote(rootDir) {
  const configFile = path.join(rootDir, ".git", "config");
  if (!fs.existsSync(configFile)) return null;
  const config = fs.readFileSync(configFile, "utf8");
  const match = config.match(/\[remote "origin"\][\s\S]*?\n\s*url\s*=\s*(.+)/);
  return match?.[1]?.trim() || null;
}

function detectFramework(rootDir) {
  const packageJson = getPackageJson(rootDir);
  const deps = {
    ...(packageJson.dependencies || {}),
    ...(packageJson.devDependencies || {})
  };

  if (deps.next) return "nextjs";
  if (deps.react) return "react";
  if (deps.vue) return "vue";
  if (deps.svelte) return "svelte";
  if (fs.existsSync(path.join(rootDir, "Package.swift"))) return "swift";
  if (fs.existsSync(path.join(rootDir, "android"))) return "android";
  return "unknown";
}

function packageManager(rootDir) {
  if (fs.existsSync(path.join(rootDir, "pnpm-lock.yaml"))) return "pnpm";
  if (fs.existsSync(path.join(rootDir, "yarn.lock"))) return "yarn";
  if (fs.existsSync(path.join(rootDir, "package-lock.json"))) return "npm";
  return "unknown";
}

function projectName(rootDir) {
  const source = getProjectSourceOfTruth(rootDir);
  const packageJson = getPackageJson(rootDir);
  return source.project?.name || packageJson.name || path.basename(rootDir);
}

function deploymentProof(targetDir) {
  const rootDir = path.resolve(targetDir);
  const source = getProjectSourceOfTruth(rootDir);
  const git = gitHead(rootDir);
  return {
    rootDir,
    generatedAt: new Date().toISOString(),
    projectName: projectName(rootDir),
    git,
    defaultProofCommands: source.verification?.defaultCommands || [],
    releaseChecks: source.verification?.releaseChecks || [],
    notes: [
      "Record deployment URL, build status, smoke-test URL, and proof command output here.",
      "Do not paste secrets, token values, private customer data, or local-only machine paths."
    ]
  };
}

function deploymentProofMarkdown(proof) {
  const lines = [
    "# Deployment Proof",
    "",
    `Generated: ${proof.generatedAt}`,
    `Project: ${proof.projectName}`,
    `Branch: ${proof.git.branch || "unknown"}`,
    `Commit: ${proof.git.commit || "unknown"}`,
    "",
    "## Proof Commands",
    ...(proof.defaultProofCommands.length ? proof.defaultProofCommands.map((command) => `- [ ] \`${command}\``) : ["- [ ] Add fastest meaningful proof command"]),
    "",
    "## Release Checks",
    ...(proof.releaseChecks.length ? proof.releaseChecks.map((check) => `- [ ] ${check}`) : ["- [ ] Add release checks"]),
    "",
    "## Evidence",
    "- Deployment URL:",
    "- Build status:",
    "- Smoke test URL:",
    "- Result:",
    "",
    "## Safety",
    ...proof.notes.map((note) => `- ${note}`),
    ""
  ];
  return lines.join("\n");
}

function writeOutputFile(rootDir, output, fallbackName, content) {
  const target = path.resolve(rootDir, output || fallbackName);
  ensureDir(path.dirname(target));
  fs.writeFileSync(target, content, "utf8");
  return target;
}

function timestampSlug() {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

function availableOutput(rootDir, primaryName, fallbackName) {
  if (!fs.existsSync(path.join(rootDir, primaryName))) return primaryName;
  return fallbackName;
}

function incidentMarkdown(summary, rootDir) {
  const safeSummary = String(summary || "Untitled incident").trim() || "Untitled incident";
  return [
    "# Incident Report",
    "",
    `Created: ${new Date().toISOString()}`,
    `Project: ${projectName(rootDir)}`,
    `Summary: ${safeSummary}`,
    "",
    "## Impact",
    "- What broke:",
    "- Who is affected:",
    "- Current status:",
    "",
    "## Timeline",
    "- Start:",
    "- First signal:",
    "- Mitigation:",
    "- Resolution:",
    "",
    "## Suspected Causes",
    "-",
    "",
    "## Proof Steps",
    "- [ ] Inspect source of truth",
    "- [ ] Check deployment state",
    "- [ ] Reproduce or verify current behavior",
    "- [ ] Run fastest meaningful proof command",
    "",
    "## Resolution Notes",
    "-",
    "",
    "## Safety",
    "- Do not store secrets, token values, private customer data, or local machine-only paths in this incident report.",
    ""
  ].join("\n");
}

function handoffPrompt(targetDir) {
  const rootDir = path.resolve(targetDir);
  const source = getProjectSourceOfTruth(rootDir);
  const readFirst = source.contextMinimizer?.readFirst || ["AGENTS.md", "REPO_SOURCE_OF_TRUTH.json", "WORKING_NOTES.md"];
  const doNotLoad = source.contextMinimizer?.doNotLoadByDefault || ["node_modules", "build", "dist", ".next", "large logs"];
  const proofCommands = source.verification?.defaultCommands || [];

  return [
    "Read the AiML SuperAgent operating files before editing code.",
    "",
    "Read first:",
    ...readFirst.map((file) => `- ${file}`),
    "",
    "Do not load by default:",
    ...doNotLoad.map((item) => `- ${item}`),
    "",
    "Before changing code:",
    "- Confirm which backend, service, deployment, or environment is live when relevant.",
    "- Inspect the relevant source file before proposing or applying changes.",
    "- Treat old notes as suspect until verified against source or production reality.",
    "- Make the smallest safe diff.",
    "- Run the fastest meaningful proof.",
    "- Update durable memory only if reality changed.",
    "- Never store secrets, credential values, private customer data, local machine paths, or scratch-only notes in committed files.",
    "",
    "Suggested proof commands:",
    ...(proofCommands.length ? proofCommands.map((command) => `- ${command}`) : ["- Add the fastest meaningful proof command for this repo."]),
    ""
  ].join("\n");
}

function deepDoctorReport(rootDir, result) {
  const context = contextReport(rootDir);
  const env = envAudit(rootDir);
  const missingProof = !fs.existsSync(path.join(rootDir, "PRODUCTION_CHECK.md"));
  const staleRisk = result.findings.filter((finding) => finding.rule?.includes("placeholder") || finding.message.includes("placeholder"));

  return {
    context,
    envSummary: env.summary,
    productionCheckPresent: !missingProof,
    staleRiskCount: staleRisk.length,
    recommendedNextReads: [
      "REPO_SOURCE_OF_TRUTH.json",
      "WORKING_NOTES.md",
      "PRODUCTION_CHECK.md"
    ].filter((file) => fs.existsSync(path.join(rootDir, file))),
    recommendations: [
      ...(missingProof ? ["Add PRODUCTION_CHECK.md for live-state verification."] : []),
      ...(context.oversized.length ? ["Compress or archive oversized context files before long agent sessions."] : []),
      ...(env.summary.localNotInExampleCount ? ["Reconcile local env names with .env.example before deployment work."] : []),
      "Use `aiml-superagent handoff .` before starting a new AI coding session."
    ]
  };
}

function printDeepDoctor(report, jsonMode) {
  if (jsonMode) return;
  console.log("Deep doctor:");
  console.log(`- Context estimated tokens if loaded all: ${report.context.estimatedTokens}`);
  console.log(`- Env unique names: ${report.envSummary.uniqueNameCount}`);
  console.log(`- Production check present: ${report.productionCheckPresent ? "yes" : "no"}`);
  console.log(`- Stale/template risk count: ${report.staleRiskCount}`);
  console.log("Deep recommendations:");
  for (const item of report.recommendations) console.log(`- ${item}`);
}

function syncPayload(targetDir, options, readiness) {
  const rootDir = path.resolve(targetDir);
  const git = gitHead(rootDir);
  const payload = {
    projectName: projectName(rootDir),
    framework: detectFramework(rootDir),
    packageManager: packageManager(rootDir),
    gitBranch: git.branch || null,
    gitCommit: git.commit || null,
    includeRemote: Boolean(options.includeRemote),
    repoRemote: options.includeRemote ? gitRemote(rootDir) : null,
    readiness,
    packageName: "@aimlsuperagent/agent",
    packageVersion: packageVersion(),
    metadata: {
      hasSourceOfTruth: fs.existsSync(path.join(rootDir, "REPO_SOURCE_OF_TRUTH.json")),
      hasWorkingNotes: fs.existsSync(path.join(rootDir, "WORKING_NOTES.md")),
      hasDeploymentLog: fs.existsSync(path.join(rootDir, "DEPLOYMENT_LOG.md")),
      hasSafeEnvAudit: fs.existsSync(path.join(rootDir, "SAFE_ENV_AUDIT.md"))
    }
  };
  return payload;
}

function safeJsonParse(value) {
  const text = String(value || "").trim();
  if (!text) return {};

  try {
    const parsed = JSON.parse(text);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function normalizeMemoryKind(value) {
  const normalized = String(value || "command")
    .trim()
    .toLowerCase()
    .replace(/[-\s]+/g, "_");
  const allowed = new Set([
    "command",
    "failure",
    "deployment",
    "decision",
    "rag_eval",
    "conversation",
    "production_check"
  ]);

  return allowed.has(normalized) ? normalized : "command";
}

function memoryPayload(targetDir, options) {
  const rootDir = path.resolve(targetDir || ".");
  const git = gitHead(rootDir);
  const kind = normalizeMemoryKind(options.kind);
  const metadata = safeJsonParse(options.metadataJson);

  return compactObject({
    kind,
    projectName: projectName(rootDir),
    repoRemote: options.includeRemote ? gitRemote(rootDir) : null,
    gitBranch: git.branch || null,
    gitCommit: git.commit || null,
    title: options.title || `${kind.replace(/_/g, " ")} record`,
    summary: options.summary || null,
    status: options.status || (kind === "failure" ? "failed" : "recorded"),
    commandText: options.commandText || null,
    cwd: path.relative(rootDir, process.cwd()) || ".",
    exitCode: options.exitCode,
    durationMs: options.durationMs,
    errorText: options.errorText || null,
    rootCause: options.rootCause || null,
    fixSummary: options.fixSummary || null,
    deploymentTarget: options.deploymentTarget || null,
    deploymentUrl: options.deploymentUrl || null,
    verificationStatus: options.verificationStatus || null,
    decision: options.decision || null,
    rationale: options.rationale || null,
    evalScore: options.evalScore,
    evalPassing: options.evalPassing,
    evalTotal: options.evalTotal,
    occurredAt: new Date().toISOString(),
    packageName: "@aimlsuperagent/agent",
    packageVersion: packageVersion(),
    metadata
  });
}

async function syncProject(apiKey, payload, options = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), apiTimeoutMs());

  try {
    const response = await globalThis.fetch(projectSyncEndpoint(options), {
      method: "POST",
      headers: {
        authorization: `Bearer ${apiKey}`,
        "content-type": "application/json",
        "user-agent": `aiml-superagent/${packageVersion()} node/${process.version}`
      },
      body: JSON.stringify(payload),
      signal: controller.signal
    });

    let responseBody = {};
    try {
      responseBody = await response.json();
    } catch {
      responseBody = {};
    }

    if (!response.ok || responseBody.ok !== true) {
      return {
        ok: false,
        status: response.status,
        reason: responseBody.reason || `http-${response.status}`
      };
    }

    return {
      ok: true,
      status: response.status,
      ...responseBody
    };
  } catch (error) {
    return {
      ok: false,
      reason: error?.name === "AbortError" ? "sync-timeout" : "sync-request-failed",
      error: error instanceof Error ? error.message : String(error)
    };
  } finally {
    clearTimeout(timeout);
  }
}

async function recordMemoryEvent(apiKey, payload, options = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), apiTimeoutMs());

  try {
    const response = await globalThis.fetch(memoryEventsEndpoint(options), {
      method: "POST",
      headers: {
        authorization: `Bearer ${apiKey}`,
        "content-type": "application/json",
        "user-agent": `aiml-superagent/${packageVersion()} node/${process.version}`
      },
      body: JSON.stringify(payload),
      signal: controller.signal
    });

    let responseBody = {};
    try {
      responseBody = await response.json();
    } catch {
      responseBody = {};
    }

    if (!response.ok || responseBody.ok !== true) {
      return {
        ok: false,
        status: response.status,
        reason: responseBody.reason || `http-${response.status}`
      };
    }

    return {
      ok: true,
      status: response.status,
      ...responseBody
    };
  } catch (error) {
    return {
      ok: false,
      reason: error?.name === "AbortError" ? "memory-timeout" : "memory-request-failed",
      error: error instanceof Error ? error.message : String(error)
    };
  } finally {
    clearTimeout(timeout);
  }
}

function parseArgs(argv) {
  const args = [...argv];
  const options = {
    json: false,
    release: false,
    strict: false,
    deep: false,
    includeRemote: false,
    analytics: null,
    apiKey: null,
    apiBaseUrl: null,
    output: null,
    feature: null,
    provider: null,
    plan: null,
    billing: null,
    browser: null,
    kind: null,
    title: null,
    summary: null,
    status: null,
    commandText: null,
    exitCode: null,
    durationMs: null,
    errorText: null,
    rootCause: null,
    fixSummary: null,
    deploymentTarget: null,
    deploymentUrl: null,
    verificationStatus: null,
    decision: null,
    rationale: null,
    evalScore: null,
    evalPassing: null,
    evalTotal: null,
    metadataJson: null
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
    } else if (arg === "--deep") {
      options.deep = true;
    } else if (arg === "--include-remote") {
      options.includeRemote = true;
    } else if (arg === "--analytics") {
      options.analytics = true;
    } else if (arg === "--no-analytics") {
      options.analytics = false;
    } else if (arg === "--browser") {
      options.browser = true;
    } else if (arg === "--no-browser") {
      options.browser = false;
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
    } else if (arg === "--output" || arg === "-o") {
      options.output = args[index + 1] || "";
      index += 1;
    } else if (arg.startsWith("--output=")) {
      options.output = arg.slice("--output=".length);
    } else if (arg === "--feature") {
      options.feature = args[index + 1] || "";
      index += 1;
    } else if (arg.startsWith("--feature=")) {
      options.feature = arg.slice("--feature=".length);
    } else if (arg === "--provider") {
      options.provider = args[index + 1] || "";
      index += 1;
    } else if (arg.startsWith("--provider=")) {
      options.provider = arg.slice("--provider=".length);
    } else if (arg === "--plan") {
      options.plan = args[index + 1] || "";
      index += 1;
    } else if (arg.startsWith("--plan=")) {
      options.plan = arg.slice("--plan=".length);
    } else if (arg === "--billing") {
      options.billing = args[index + 1] || "";
      index += 1;
    } else if (arg.startsWith("--billing=")) {
      options.billing = arg.slice("--billing=".length);
    } else if (arg === "--kind") {
      options.kind = args[index + 1] || "";
      index += 1;
    } else if (arg.startsWith("--kind=")) {
      options.kind = arg.slice("--kind=".length);
    } else if (arg === "--title") {
      options.title = args[index + 1] || "";
      index += 1;
    } else if (arg.startsWith("--title=")) {
      options.title = arg.slice("--title=".length);
    } else if (arg === "--summary") {
      options.summary = args[index + 1] || "";
      index += 1;
    } else if (arg.startsWith("--summary=")) {
      options.summary = arg.slice("--summary=".length);
    } else if (arg === "--status") {
      options.status = args[index + 1] || "";
      index += 1;
    } else if (arg.startsWith("--status=")) {
      options.status = arg.slice("--status=".length);
    } else if (arg === "--command-text" || arg === "--command") {
      options.commandText = args[index + 1] || "";
      index += 1;
    } else if (arg.startsWith("--command-text=")) {
      options.commandText = arg.slice("--command-text=".length);
    } else if (arg.startsWith("--command=")) {
      options.commandText = arg.slice("--command=".length);
    } else if (arg === "--exit-code") {
      options.exitCode = args[index + 1] || "";
      index += 1;
    } else if (arg.startsWith("--exit-code=")) {
      options.exitCode = arg.slice("--exit-code=".length);
    } else if (arg === "--duration-ms") {
      options.durationMs = args[index + 1] || "";
      index += 1;
    } else if (arg.startsWith("--duration-ms=")) {
      options.durationMs = arg.slice("--duration-ms=".length);
    } else if (arg === "--error") {
      options.errorText = args[index + 1] || "";
      index += 1;
    } else if (arg.startsWith("--error=")) {
      options.errorText = arg.slice("--error=".length);
    } else if (arg === "--root-cause") {
      options.rootCause = args[index + 1] || "";
      index += 1;
    } else if (arg.startsWith("--root-cause=")) {
      options.rootCause = arg.slice("--root-cause=".length);
    } else if (arg === "--fix") {
      options.fixSummary = args[index + 1] || "";
      index += 1;
    } else if (arg.startsWith("--fix=")) {
      options.fixSummary = arg.slice("--fix=".length);
    } else if (arg === "--deployment-target") {
      options.deploymentTarget = args[index + 1] || "";
      index += 1;
    } else if (arg.startsWith("--deployment-target=")) {
      options.deploymentTarget = arg.slice("--deployment-target=".length);
    } else if (arg === "--deployment-url") {
      options.deploymentUrl = args[index + 1] || "";
      index += 1;
    } else if (arg.startsWith("--deployment-url=")) {
      options.deploymentUrl = arg.slice("--deployment-url=".length);
    } else if (arg === "--verification-status") {
      options.verificationStatus = args[index + 1] || "";
      index += 1;
    } else if (arg.startsWith("--verification-status=")) {
      options.verificationStatus = arg.slice("--verification-status=".length);
    } else if (arg === "--decision") {
      options.decision = args[index + 1] || "";
      index += 1;
    } else if (arg.startsWith("--decision=")) {
      options.decision = arg.slice("--decision=".length);
    } else if (arg === "--rationale") {
      options.rationale = args[index + 1] || "";
      index += 1;
    } else if (arg.startsWith("--rationale=")) {
      options.rationale = arg.slice("--rationale=".length);
    } else if (arg === "--score") {
      options.evalScore = args[index + 1] || "";
      index += 1;
    } else if (arg.startsWith("--score=")) {
      options.evalScore = arg.slice("--score=".length);
    } else if (arg === "--passing") {
      options.evalPassing = args[index + 1] || "";
      index += 1;
    } else if (arg.startsWith("--passing=")) {
      options.evalPassing = arg.slice("--passing=".length);
    } else if (arg === "--total") {
      options.evalTotal = args[index + 1] || "";
      index += 1;
    } else if (arg.startsWith("--total=")) {
      options.evalTotal = arg.slice("--total=".length);
    } else if (arg === "--metadata-json") {
      options.metadataJson = args[index + 1] || "";
      index += 1;
    } else if (arg.startsWith("--metadata-json=")) {
      options.metadataJson = arg.slice("--metadata-json=".length);
    } else {
      positionals.push(arg);
    }
  }

  return { command: positionals[0], targetArg: positionals[1], positionals, options };
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
      deep: Boolean(options.deep),
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
  const { command, targetArg, positionals, options } = parseArgs(process.argv.slice(2));

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

  if (command === "signin" || command === "sign-in" || command === "account-login") {
    const invalid = invalidSigninOption(options);
    if (invalid) {
      if (options.json) {
        console.log(JSON.stringify({ error: "invalid-signin-option", ...invalid }, null, 2));
      } else {
        console.error(invalid.message);
      }
      const exitCode = 1;
      await recordCliAnalytics(options, {
        command: "signin",
        exitCode,
        durationMs: Date.now() - startedAt
      });
      return exitCode;
    }

    const signin = accountSigninUrl(options);
    const openResult = shouldOpenBrowser(options)
      ? openBrowserUrl(signin.url)
      : { opened: false };
    const pending = {
      status: "pending-browser",
      url: signin.url,
      provider: signin.provider,
      planKey: signin.planKey,
      billingPeriod: signin.billingPeriod,
      startedAt: new Date().toISOString(),
      packageName: "@aimlsuperagent/agent",
      packageVersion: packageVersion()
    };
    savePendingBrowserSignin(pending);

    const payload = {
      state: "pending-browser",
      opened: Boolean(openResult.opened),
      openError: openResult.error,
      url: signin.url,
      configPath: configPath(),
      nextStep: "Complete checkout or sign-in in the browser, copy the issued API key, then run `aiml-superagent login <api-key>`."
    };

    if (options.json) {
      console.log(JSON.stringify(payload, null, 2));
    } else {
      console.log("AiML SuperAgent browser sign-in started.");
      console.log(`URL: ${signin.url}`);
      console.log(`Browser opened: ${payload.opened ? "yes" : "no"}`);
      if (payload.openError) console.log(`Browser open error: ${payload.openError}`);
      console.log("Next: complete checkout/sign-in, copy the issued API key, then run:");
      console.log("  aiml-superagent login <api-key>");
      console.log("Check local auth state with:");
      console.log("  aiml-superagent signin-check");
    }

    const exitCode = 0;
    await recordCliAnalytics(options, {
      command: "signin",
      exitCode,
      durationMs: Date.now() - startedAt
    });
    return exitCode;
  }

  if (command === "signin-check" || command === "sign-in-check" || command === "account-check") {
    const status = await licenseStatus({
      ...options,
      featureKey: "browser_signin_check",
      commandName: "signin-check"
    });
    const pending = pendingBrowserSignin();

    if (status.valid) {
      const payload = {
        state: "signed-in",
        license: status
      };
      if (options.json) {
        console.log(JSON.stringify(payload, null, 2));
      } else {
        console.log("AiML SuperAgent account: signed in");
        printLicenseStatus(status, false);
      }
      const exitCode = 0;
      await recordCliAnalytics(options, {
        command: "signin-check",
        exitCode,
        durationMs: Date.now() - startedAt
      });
      return exitCode;
    }

    const state = pending ? "pending-browser" : status.mode === "unverified" ? "invalid-key" : "not-signed-in";
    const payload = {
      state,
      license: status,
      pendingBrowserSignin: pending,
      nextStep: pending
        ? "Complete the browser flow, copy the issued API key, then run `aiml-superagent login <api-key>`."
        : "Run `aiml-superagent signin` to open the account flow, or `aiml-superagent login <api-key>` if you already have a key."
    };

    if (options.json) {
      console.log(JSON.stringify(payload, null, 2));
    } else {
      console.log(`AiML SuperAgent account: ${state}`);
      if (pending) {
        console.log(`Pending URL: ${pending.url}`);
        console.log(`Started: ${pending.startedAt}`);
      }
      console.log(payload.nextStep);
    }

    const exitCode = 1;
    await recordCliAnalytics(options, {
      command: "signin-check",
      exitCode,
      durationMs: Date.now() - startedAt
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
    const feature = String(options.feature || targetArg || "").trim();
    const pricingUrl = feature
      ? `https://aimlsuperagent.com/?feature=${encodeURIComponent(feature)}#pricing`
      : "https://aimlsuperagent.com/#pricing";

    if (options.json) {
      console.log(
        JSON.stringify(
          {
            feature: feature || null,
            pricingUrl,
            accountUrl: "https://aimlsuperagent.com/",
            apiKeyHelp: "Subscribe, create an API key, then run `aiml-superagent login <api-key>`.",
            premiumCommands: [
              "doctor --deep",
              "sync",
              "env-audit",
              "context-report",
              "ci",
              "incident",
              "handoff",
              "deploy-proof",
              "usage"
            ]
          },
          null,
          2
        )
      );
    } else {
      console.log("AiML SuperAgent paid CLI");
      if (feature) console.log(`Feature: ${feature}`);
      console.log(`Pricing: ${pricingUrl}`);
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
    const paid = await requirePaidLicense(options, options.deep ? "doctor_deep" : "doctor", "doctor");

    if (!paid.ok) {
      printPaidRequired(options.deep ? "doctor --deep" : "doctor", paid.license, options.json);
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
    const deepReport = options.deep ? deepDoctorReport(targetDir, result) : null;

    if (options.json && deepReport) {
      console.log(
        JSON.stringify(
          {
            rootDir: result.rootDir,
            readiness,
            license: paid.license,
            paidFeatures: {
              doctor: true,
              doctorDeep: true,
              remoteVerification: true
            },
            findings: result.findings,
            deepReport
          },
          null,
          2
        )
      );
    } else {
      printDoctor(result, paid.license, options.json);
      if (deepReport) printDeepDoctor(deepReport, options.json);
    }

    const exitCode = readiness.high > 0 || (options.strict && readiness.medium > 0) ? 1 : 0;
    await recordCliAnalytics(options, {
      command,
      exitCode,
      durationMs: Date.now() - startedAt,
      readiness
    });
    return exitCode;
  }

  if (command === "usage") {
    const paid = await requirePaidLicense(options, "license_usage", "usage");
    if (!paid.ok) {
      printPaidRequired("usage", paid.license, options.json);
      const exitCode = 1;
      await recordCliAnalytics(options, { command, exitCode, durationMs: Date.now() - startedAt });
      return exitCode;
    }

    if (options.json) {
      console.log(JSON.stringify(paid.license, null, 2));
    } else {
      printLicenseStatus(paid.license, false);
      console.log("Usage includes successful paid verification events and feature-gated command checks.");
    }

    const exitCode = 0;
    await recordCliAnalytics(options, { command, exitCode, durationMs: Date.now() - startedAt });
    return exitCode;
  }

  if (command === "context-report") {
    const paid = await requirePaidLicense(options, "context_report", "context-report");
    if (!paid.ok) {
      printPaidRequired("context-report", paid.license, options.json);
      const exitCode = 1;
      await recordCliAnalytics(options, { command, exitCode, durationMs: Date.now() - startedAt });
      return exitCode;
    }

    const report = contextReport(targetArg || ".");
    printContextReport(report, options.json);
    const exitCode = report.oversized.length > 0 && options.strict ? 1 : 0;
    await recordCliAnalytics(options, { command, exitCode, durationMs: Date.now() - startedAt });
    return exitCode;
  }

  if (command === "env-audit") {
    const paid = await requirePaidLicense(options, "env_audit", "env-audit");
    if (!paid.ok) {
      printPaidRequired("env-audit", paid.license, options.json);
      const exitCode = 1;
      await recordCliAnalytics(options, { command, exitCode, durationMs: Date.now() - startedAt });
      return exitCode;
    }

    const audit = envAudit(targetArg || ".");
    printEnvAudit(audit, options.json);
    const exitCode = options.strict && audit.summary.localNotInExampleCount > 0 ? 1 : 0;
    await recordCliAnalytics(options, { command, exitCode, durationMs: Date.now() - startedAt });
    return exitCode;
  }

  if (command === "ci") {
    const paid = await requirePaidLicense(options, "ci", "ci");
    if (!paid.ok) {
      printPaidRequired("ci", paid.license, options.json);
      const exitCode = 1;
      await recordCliAnalytics(options, { command, exitCode, durationMs: Date.now() - startedAt });
      return exitCode;
    }

    const targetDir = path.resolve(targetArg || ".");
    const result = checkProject(targetDir, { ...options, release: true, strict: true });
    const readiness = score(result.findings);
    const context = contextReport(targetDir);
    const env = envAudit(targetDir);
    const payload = {
      rootDir: result.rootDir,
      readiness,
      findings: result.findings,
      context: {
        estimatedTokens: context.estimatedTokens,
        oversized: context.oversized
      },
      env: env.summary
    };

    if (options.json) {
      console.log(JSON.stringify(payload, null, 2));
    } else {
      printCheck(result, false);
      console.log(`Context estimated tokens: ${context.estimatedTokens}`);
      console.log(`Env unique names: ${env.summary.uniqueNameCount}`);
    }

    const exitCode =
      readiness.high > 0 ||
      readiness.medium > 0 ||
      context.oversized.length > 0 ||
      env.summary.localNotInExampleCount > 0
        ? 1
        : 0;
    await recordCliAnalytics(options, { command, exitCode, durationMs: Date.now() - startedAt, readiness });
    return exitCode;
  }

  if (command === "incident") {
    const paid = await requirePaidLicense(options, "incident", "incident");
    if (!paid.ok) {
      printPaidRequired("incident", paid.license, options.json);
      const exitCode = 1;
      await recordCliAnalytics(options, { command, exitCode, durationMs: Date.now() - startedAt });
      return exitCode;
    }

    const rootDir = path.resolve(".");
    const summary = positionals.slice(1).join(" ") || "Untitled incident";
    const defaultName = availableOutput(rootDir, "INCIDENT_REPORT.md", `incidents/${timestampSlug()}-incident.md`);
    const target = writeOutputFile(rootDir, options.output, defaultName, incidentMarkdown(summary, rootDir));
    if (options.json) {
      console.log(JSON.stringify({ created: target, summary }, null, 2));
    } else {
      console.log(`Incident report created: ${target}`);
    }

    const exitCode = 0;
    await recordCliAnalytics(options, { command, exitCode, durationMs: Date.now() - startedAt });
    return exitCode;
  }

  if (command === "handoff") {
    const paid = await requirePaidLicense(options, "handoff", "handoff");
    if (!paid.ok) {
      printPaidRequired("handoff", paid.license, options.json);
      const exitCode = 1;
      await recordCliAnalytics(options, { command, exitCode, durationMs: Date.now() - startedAt });
      return exitCode;
    }

    const rootDir = path.resolve(targetArg || ".");
    const prompt = handoffPrompt(rootDir);
    if (options.output) {
      const target = writeOutputFile(rootDir, options.output, "SUPERAGENT_HANDOFF.md", prompt);
      if (options.json) console.log(JSON.stringify({ created: target }, null, 2));
      else console.log(`Handoff prompt written: ${target}`);
    } else if (options.json) {
      console.log(JSON.stringify({ rootDir, prompt }, null, 2));
    } else {
      console.log(prompt);
    }

    const exitCode = 0;
    await recordCliAnalytics(options, { command, exitCode, durationMs: Date.now() - startedAt });
    return exitCode;
  }

  if (command === "deploy-proof") {
    const paid = await requirePaidLicense(options, "deploy_proof", "deploy-proof");
    if (!paid.ok) {
      printPaidRequired("deploy-proof", paid.license, options.json);
      const exitCode = 1;
      await recordCliAnalytics(options, { command, exitCode, durationMs: Date.now() - startedAt });
      return exitCode;
    }

    const rootDir = path.resolve(targetArg || ".");
    const proof = deploymentProof(rootDir);
    if (options.json) {
      console.log(JSON.stringify(proof, null, 2));
    } else {
      const defaultName = availableOutput(rootDir, "DEPLOYMENT_PROOF.md", `deployment-proof-${timestampSlug()}.md`);
      const target = writeOutputFile(rootDir, options.output, defaultName, deploymentProofMarkdown(proof));
      console.log(`Deployment proof file written: ${target}`);
    }

    const exitCode = 0;
    await recordCliAnalytics(options, { command, exitCode, durationMs: Date.now() - startedAt });
    return exitCode;
  }

  if (command === "sync") {
    const resolved = resolveApiKey(options);
    if (!resolved.apiKey) {
      const freeLicense = await licenseStatus(options);
      printPaidRequired("sync", freeLicense, options.json);
      const exitCode = 1;
      await recordCliAnalytics(options, { command, exitCode, durationMs: Date.now() - startedAt });
      return exitCode;
    }

    const targetDir = path.resolve(targetArg || ".");
    const result = checkProject(targetDir, options);
    const readiness = score(result.findings);
    const payload = syncPayload(targetDir, options, readiness);
    const response = await syncProject(resolved.apiKey, payload, options);

    if (options.json) {
      console.log(JSON.stringify({ request: payload, response }, null, 2));
    } else if (response.ok) {
      console.log(`Project synced: ${response.publicId || "ok"}`);
      console.log(`Readiness: ${readiness.label}`);
    } else {
      console.error(`Project sync failed: ${response.reason || "unknown"}`);
    }

    const exitCode = response.ok ? 0 : 1;
    await recordCliAnalytics(options, { command, exitCode, durationMs: Date.now() - startedAt, readiness });
    return exitCode;
  }

  if (command === "memory" || command === "record") {
    const resolved = resolveApiKey(options);
    if (!resolved.apiKey) {
      const freeLicense = await licenseStatus(options);
      printPaidRequired("memory", freeLicense, options.json);
      const exitCode = 1;
      await recordCliAnalytics(options, { command, exitCode, durationMs: Date.now() - startedAt });
      return exitCode;
    }

    const targetDir = path.resolve(targetArg || ".");
    const payload = memoryPayload(targetDir, options);
    const response = await recordMemoryEvent(resolved.apiKey, payload, options);

    if (options.json) {
      console.log(JSON.stringify({ request: payload, response }, null, 2));
    } else if (response.ok) {
      console.log(`Operating memory recorded: ${response.publicId || "ok"}`);
      console.log(`Kind: ${response.kind || payload.kind}`);
    } else {
      console.error(`Operating memory record failed: ${response.reason || "unknown"}`);
    }

    const exitCode = response.ok ? 0 : 1;
    await recordCliAnalytics(options, { command, exitCode, durationMs: Date.now() - startedAt });
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
