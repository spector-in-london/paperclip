import { describe, expect, it } from "vitest";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Request } from "express";
import { assertProjectCreationAllowed } from "./project-creation-policy.js";

describe("project creation policy", () => {
  it("denies listed users and their agents while preserving other actors and company scope", () => {
    const root = mkdtempSync(join(tmpdir(), "project-policy-"));
    const file = join(root, "policy.json");
    try {
      writeFileSync(file, JSON.stringify({schemaVersion: 1, deniedUsersByCompany: {company: ["restricted"]}}));
      const board = {actor: {type: "board", userId: "restricted"}} as Request;
      const agent = {actor: {type: "agent", onBehalfOfUserId: "restricted"}} as Request;
      expect(() => assertProjectCreationAllowed(board, "company", file)).toThrowError(/disabled/);
      expect(() => assertProjectCreationAllowed(agent, "company", file)).toThrowError(/disabled/);
      expect(() => assertProjectCreationAllowed(board, "other-company", file)).not.toThrow();
      expect(() => assertProjectCreationAllowed({actor: {type: "board", userId: "owner"}} as Request, "company", file)).not.toThrow();
    } finally { rmSync(root, {recursive: true, force: true}); }
  });
  it("fails closed for missing, invalid or malformed policy and rereads updates", () => {
    const root = mkdtempSync(join(tmpdir(), "project-policy-"));
    const file = join(root, "policy.json");
    const board = {actor: {type: "board", userId: "restricted"}} as Request;
    try {
      expect(() => assertProjectCreationAllowed(board, "company", file)).toThrowError(/unavailable/);
      for (const value of ["{bad", JSON.stringify({schemaVersion: 1, deniedUsersByCompany: {company: [null]}})]) {
        writeFileSync(file, value);
        expect(() => assertProjectCreationAllowed(board, "company", file)).toThrowError(/unavailable/);
      }
      writeFileSync(file, JSON.stringify({schemaVersion: 1, deniedUsersByCompany: {}}));
      expect(() => assertProjectCreationAllowed(board, "company", file)).not.toThrow();
    } finally { rmSync(root, {recursive: true, force: true}); }
  });
});
