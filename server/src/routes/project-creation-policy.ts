import type { Request } from "express";
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { HttpError } from "../errors.js";

const defaultPolicyPath = join(homedir(), ".paperclip", "instances", "default", "project-creation-policy.json");

// This policy narrows project creation without changing other membership rights.
// Read it on each creation request so a permission update needs no restart.
export function assertProjectCreationAllowed(req: Request, companyId: string, policyPath = defaultPolicyPath) {
    let policy: { schemaVersion?: number; deniedUsersByCompany?: Record<string, unknown> } | null;
    try {
        policy = JSON.parse(readFileSync(policyPath, "utf8"));
        if (policy?.schemaVersion !== 1 || !policy.deniedUsersByCompany ||
            typeof policy.deniedUsersByCompany !== "object" || Array.isArray(policy.deniedUsersByCompany) ||
            Object.entries(policy.deniedUsersByCompany).some(([key, users]) =>
                !key || !Array.isArray(users) || users.some((user: unknown) => typeof user !== "string" || !user.trim()))) {
            throw new Error("Invalid project creation policy");
        }
    } catch {
        // An unreadable policy must not silently grant restricted users access.
        throw new HttpError(503, "Project creation permissions are temporarily unavailable");
    }
    const responsibleUserId = req.actor.type === "board"
        ? req.actor.userId : req.actor.onBehalfOfUserId;
    if (responsibleUserId && (policy.deniedUsersByCompany[companyId] as string[] | undefined)?.includes(responsibleUserId)) {
        throw new HttpError(403, "Project creation is disabled for your account. Ask Brian to create the project.");
    }
}
