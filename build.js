const { spawnSync } = require("node:child_process");
const { join } = require("node:path");

const args = [join(__dirname, "scripts", "package-release.py")];
const command = process.platform === "win32" ? "py" : "python3";
if (process.platform === "win32") args.unshift("-3");
const result = spawnSync(command, args, { stdio: "inherit" });
if (result.error) console.error(result.error.message);
process.exitCode = result.status ?? 1;
