import { mkdtemp, mkdir, rm, writeFile, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, expect, test } from "vitest";

import type { AdapterSkillContext } from "@paperclipai/adapter-utils";

import {
  listHermesSkills,
  resolveHermesHome,
  syncHermesSkills,
} from "./skills.js";

// Adapter env values reach listSkills/syncSkills either already resolved to
// plain strings or, on raw-config paths, as persisted bindings shaped
// { type: "plain", value } (secret bindings stay unresolved). The resolver
// must accept both shapes and never treat a secret binding as a path.

const tmpRoots: string[] = [];

async function makeTmpRoot(prefix: string): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), prefix));
  tmpRoots.push(dir);
  return dir;
}

afterEach(async () => {
  while (tmpRoots.length > 0) {
    const dir = tmpRoots.pop();
    if (dir) await rm(dir, { recursive: true, force: true });
  }
});

async function writeSkill(
  skillsHome: string,
  category: string,
  name: string,
  description: string,
): Promise<void> {
  const dir = join(skillsHome, category, name);
  await mkdir(dir, { recursive: true });
  await writeFile(
    join(dir, "SKILL.md"),
    `---\nname: ${name}\ndescription: ${description}\n---\n\n# ${name}\n`,
    "utf8",
  );
}

function skillContext(config: Record<string, unknown>): AdapterSkillContext {
  return {
    agentId: "agent-test",
    companyId: "company-test",
    adapterType: "hermes_local",
    config,
  };
}

test("resolveHermesHome honors a string HERMES_HOME over HOME", async () => {
  const home = await makeTmpRoot("hermes-home-");
  const hermesHome = await makeTmpRoot("hermes-profile-");
  expect(resolveHermesHome({ env: { HOME: home, HERMES_HOME: hermesHome } })).toBe(
    hermesHome,
  );
});

test("resolveHermesHome honors an unresolved plain HERMES_HOME binding", async () => {
  const home = await makeTmpRoot("hermes-home-");
  const hermesHome = await makeTmpRoot("hermes-profile-");
  expect(
    resolveHermesHome({
      env: { HOME: home, HERMES_HOME: { type: "plain", value: hermesHome } },
    }),
  ).toBe(hermesHome);
});

test("resolveHermesHome honors an unresolved plain HOME binding as legacy fallback", async () => {
  const home = await makeTmpRoot("hermes-home-");
  expect(
    resolveHermesHome({ env: { HOME: { type: "plain", value: home } } }),
  ).toBe(join(home, ".hermes"));
});

test("resolveHermesHome ignores secret bindings and falls back to HOME/.hermes", async () => {
  const home = await makeTmpRoot("hermes-home-");
  expect(
    resolveHermesHome({
      env: {
        HOME: home,
        HERMES_HOME: { type: "secret_ref", secretId: "placeholder" },
      },
    }),
  ).toBe(join(home, ".hermes"));
});

test("listHermesSkills scans the profile HERMES_HOME skills root, not the global one", async () => {
  const profileA = await makeTmpRoot("hermes-profile-a-");
  const profileB = await makeTmpRoot("hermes-profile-b-");
  await writeSkill(join(profileA, "skills"), "cat-a", "alpha-skill", "alpha");
  await writeSkill(join(profileB, "skills"), "cat-b", "beta-skill", "beta");

  const snapshotA = await listHermesSkills(
    skillContext({
      env: { HERMES_HOME: { type: "plain", value: profileA } },
      paperclipRuntimeSkills: [],
    }),
  );
  const snapshotB = await listHermesSkills(
    skillContext({
      env: { HERMES_HOME: { type: "plain", value: profileB } },
      paperclipRuntimeSkills: [],
    }),
  );

  const keysA = snapshotA.entries.map((entry) => entry.key);
  const keysB = snapshotB.entries.map((entry) => entry.key);
  expect(keysA).toContain("alpha-skill");
  expect(keysA).not.toContain("beta-skill");
  expect(keysB).toContain("beta-skill");
  expect(keysB).not.toContain("alpha-skill");
});

test("syncHermesSkills reconciles into the profile skills root and leaves other profiles untouched", async () => {
  const profileA = await makeTmpRoot("hermes-profile-a-");
  const profileB = await makeTmpRoot("hermes-profile-b-");
  await writeSkill(join(profileA, "skills"), "cat-a", "alpha-skill", "alpha");
  await writeSkill(join(profileB, "skills"), "cat-b", "beta-skill", "beta");

  const snapshot = await syncHermesSkills(
    skillContext({
      env: { HERMES_HOME: { type: "plain", value: profileA } },
      paperclipRuntimeSkills: [],
    }),
    [],
  );

  // The managed skills root for profile A is created; profile B is untouched.
  await stat(join(profileA, "skills"));
  const keys = snapshot.entries.map((entry) => entry.key);
  expect(keys).toContain("alpha-skill");
  expect(keys).not.toContain("beta-skill");
  await expect(stat(join(profileB, "skills", "paperclip"))).rejects.toThrow();
});
