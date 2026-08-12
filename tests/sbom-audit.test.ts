/**
 * V FOR X — SBOM audit script integration test
 *
 * Phase 13 supply-chain: scripts/sbom-audit.sh emits a SPDX-shaped
 * sbom.json that ships with the static build. This test invokes the
 * script in a throwaway temp dir (so the repo's real sbom.json is
 * untouched) and asserts the document shape.
 */

import { describe, it, expect, beforeAll } from "vitest";
import { execSync } from "node:child_process";
import { mkdtempSync, writeFileSync, readFileSync, existsSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const REPO_ROOT = join(__dirname, "..");
const SCRIPT = join(REPO_ROOT, "scripts", "sbom-audit.sh");

function setupFixture(): string {
  const dir = mkdtempSync(join(tmpdir(), "vfx-sbom-"));
  const pkg = {
    name: "fixture-app",
    version: "0.0.1",
    dependencies: {
      // pinned
      "pinned-pkg": "1.2.3",
      // drifted
      "drifty-pkg": "^4.5.6",
      "another-drift": "~0.9.0",
    },
    devDependencies: {
      "typed-pkg": "^1.0.0",
    },
  };
  const lock = {
    name: "fixture-app",
    version: "0.0.1",
    lockfileVersion: 3,
    requires: true,
    packages: {
      "": { name: "fixture-app", version: "0.0.1" },
      "node_modules/pinned-pkg": {
        version: "1.2.3",
        integrity: "sha512-aaaa",
        resolved: "https://registry.npmjs.org/pinned-pkg/-/pinned-pkg-1.2.3.tgz",
      },
      "node_modules/drifty-pkg": {
        version: "4.5.6",
        integrity: "sha512-bbbb",
        resolved: "https://registry.npmjs.org/drifty-pkg/-/drifty-pkg-4.5.6.tgz",
      },
      "node_modules/another-drift": {
        version: "0.9.0",
        integrity: "sha512-cccc",
      },
      "node_modules/typed-pkg": {
        version: "1.0.0",
        integrity: "sha512-dddd",
      },
    },
  };
  writeFileSync(join(dir, "package.json"), JSON.stringify(pkg, null, 2));
  writeFileSync(join(dir, "package-lock.json"), JSON.stringify(lock, null, 2));
  return dir;
}

describe("scripts/sbom-audit.sh", () => {
  let dir: string;
  let sbomPath: string;

  beforeAll(() => {
    dir = setupFixture();
    sbomPath = join(dir, "sbom.json");
    execSync(`bash "${SCRIPT}"`, {
      cwd: dir,
      env: { ...process.env },
    });
  });

  it("exits 0 in default (warn) mode", () => {
    expect(() =>
      execSync(`bash "${SCRIPT}"`, { cwd: dir, env: { ...process.env } }),
    ).not.toThrow();
  });

  it("exits 1 in STRICT mode when drift exists", () => {
    let exitCode = 0;
    try {
      execSync(`bash "${SCRIPT}"`, {
        cwd: dir,
        env: { ...process.env, VFX_SBOM_STRICT: "1" },
        stdio: "pipe",
      });
    } catch (e: unknown) {
      const err = e as { status?: number };
      exitCode = err.status ?? 0;
    }
    expect(exitCode).toBe(1);
  });

  it("writes sbom.json next to the fixture", () => {
    expect(existsSync(sbomPath)).toBe(true);
  });

  it("emits SPDX-2.3 shape", () => {
    const sbom = JSON.parse(readFileSync(sbomPath, "utf8"));
    expect(sbom.spdxVersion).toBe("SPDX-2.3");
    expect(sbom.SPDXID).toBe("SPDXRef-DOCUMENT");
    expect(sbom.dataLicense).toBe("CC0-1.0");
    expect(sbom.creationInfo.created).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/);
    expect(Array.isArray(sbom.creationInfo.creators)).toBe(true);
  });

  it("lists every declared dependency", () => {
    const sbom = JSON.parse(readFileSync(sbomPath, "utf8"));
    const names = sbom.packages.map((p: { name: string }) => p.name).sort();
    expect(names).toEqual(
      ["another-drift", "drifty-pkg", "pinned-pkg", "typed-pkg"].sort(),
    );
  });

  it("resolves locked versions + integrity from package-lock.json", () => {
    const sbom = JSON.parse(readFileSync(sbomPath, "utf8"));
    const pinned = sbom.packages.find(
      (p: { name: string }) => p.name === "pinned-pkg",
    );
    expect(pinned.version).toBe("1.2.3");
    expect(pinned.integrity).toBe("sha512-aaaa");
    expect(pinned.resolved).toContain("pinned-pkg-1.2.3.tgz");
    expect(pinned.pinned).toBe(true);
  });

  it("flags drift correctly", () => {
    const sbom = JSON.parse(readFileSync(sbomPath, "utf8"));
    const driftNames = sbom.drift.map((d: { name: string }) => d.name).sort();
    expect(driftNames).toEqual(["another-drift", "drifty-pkg", "typed-pkg"].sort());
    expect(sbom.driftCount).toBe(3);
  });

  it("records source hashes for tamper evidence", () => {
    const sbom = JSON.parse(readFileSync(sbomPath, "utf8"));
    expect(sbom.sourceHashes["package.json"]).toMatch(/^[0-9a-f]{64}$/);
    expect(sbom.sourceHashes["package-lock.json"]).toMatch(/^[0-9a-f]{64}$/);
  });

  it("handles missing package-lock.json gracefully", () => {
    const dir2 = mkdtempSync(join(tmpdir(), "vfx-sbom-nolock-"));
    writeFileSync(
      join(dir2, "package.json"),
      JSON.stringify({ name: "x", dependencies: { foo: "1.0.0" } }),
    );
    expect(() =>
      execSync(`bash "${SCRIPT}"`, { cwd: dir2, env: { ...process.env } }),
    ).not.toThrow();
    const sbom = JSON.parse(readFileSync(join(dir2, "sbom.json"), "utf8"));
    expect(sbom.sourceHashes["package-lock.json"]).toBeNull();
    rmSync(dir2, { recursive: true, force: true });
  });
});
