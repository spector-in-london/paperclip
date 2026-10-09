# Protected local assets in LLM Wiki

Status: draft for maintainer discussion; implementation has not started upstream.
Date: 2026-10-08
Source snapshot: `1c4ce44e137b22a3f27a7383caf2fc65eda22fac`

## Problem and scope

A local Wiki can contain images, audio, video, and PDFs under `assets/`.
The current browse tree lists Markdown pages and captured text sources.
It does not list those local files or resolve relative media links through a
protected read path. A link such as `../../assets/diagram.png` in
`wiki/projects/example.md` therefore has no supported Wiki asset preview.

This proposal covers files already stored in a configured Wiki folder.
It does not fetch Paperclip issue attachments or work-product URLs, parse
binary files for a model, or add them to ingestion snapshots. The accepted
Phase 5 metadata-only policy remains in force for those source kinds.

## Source prerequisites

The current source has company-scoped host action context, but the Wiki
`SpaceInput` and `resolveSpace` do not accept that context. The resolver
selects a space by company, wiki, and slug. Protected asset reads need a
source-native space authorization contract before they can support shared,
personal, and team spaces with the same access boundaries.

The current `PluginLocalFoldersClient` provides listing and UTF-8 reads.
It has no binary-read method. The binary transport and its limits must be
agreed with maintainers. A public static directory would bypass the required
company and space checks, so it is not a suitable transport.

The SDK `MarkdownBlock` forwards Wiki link options to the native renderer.
It does not expose the native image resolver. The integration must preserve
existing issue links, Wiki links, tables, code, and Mermaid rendering.

## Proposed implementation order

1. Add or reuse source-native Wiki space authorization. The host supplies
   the authenticated principal and authorized company. Client parameters
   cannot supply the principal. Check personal ownership and team access on
   every list and read. Fail closed when the access rule is unavailable.
2. Add a protected binary read through the local-folder host contract or an
   equivalent authenticated stream. Keep the configured folder boundary.
   Restrict paths to `assets/`, use a positive media allowlist, and reject
   hidden paths, traversal, symlinks, and non-regular files. Bound listings,
   depth, byte reads, and allocation. Reject files that change during a read.
3. Add local asset metadata to the native Wiki tree. Preserve page, source,
   search, revision, editing, and selected-resource behavior.
4. Add image, audio, and video previews with original-file downloads. Resolve
   relative Markdown media links against the actual source page and space.
   Use the protected bridge for bytes. Preserve lazy image loading and stable
   renderer identities. Revoke Blob URLs on replacement or unmount. A company
   or space switch must discard the prior request result and preview.

These changes should be separate, reviewable commits or dependent pull requests.
A shared-only implementation is not equivalent to the requested full scope.

## Required validation

- Host-authorized company scope overrides spoofed client scope.
- Unauthenticated and unauthorized personal/team requests fail before bytes
  or asset metadata are returned. Allowed users receive only their space.
- Exact downloaded bytes and hashes match the original files, including
  Unicode filenames and nested paths.
- Traversal, hidden entries, unsupported formats, symlinks, oversize files,
  excessive listing depth/count, and file mutation during reads are rejected.
- The native folder tree opens previews and downloads at wide and narrow
  layouts. Relative links work from nested Markdown pages.
- An identical rerender retains the media element and does not fetch it again.
  Offscreen images stay unfetched until visible. Scope changes clean up URLs.
- Issue links, Wiki links, tables, Mermaid, code, editing, and revisions retain
  their native behavior. Unsafe and malformed URLs remain inert.
- Run relevant package tests first, then required repository checks and
  current-head CI/security review before a ready-for-review handoff.

## Maintainer decisions and trigger

Before implementation, agree on the space authorization rules, protected binary
transport, byte/message limits, and native Markdown image extension point.
`CONTRIBUTING.md` Path 2 requires discussion in Discord `#dev` and rough agreement
before building bigger or impactful changes. This design and its feature issue
are discussion material; they do not claim that agreement has occurred.

After agreement on those prerequisites, the contributor will implement the
source-native port in a dedicated worktree, add regression tests, obtain
independent review, and submit a draft PR. No compiled runtime snapshot or local
deployment tooling belongs in that contribution.

## Primary references

- `packages/plugins/plugin-llm-wiki/src/wiki/core.ts`: `SpaceInput`,
  `resolveSpace`, and the restricted-space ingestion guard.
- `packages/plugins/sdk/src/protocol.ts`: `PluginPerformActionActorContext`.
- `packages/plugins/sdk/src/types.ts`: `PluginLocalFoldersClient`.
- `packages/plugins/sdk/src/ui/components.ts`: `MarkdownBlockProps`.
- `ui/src/plugins/bridge-init.ts`: native `MarkdownBlock` bridge.
- `doc/plans/2026-05-06-llm-wiki-paperclip-asset-security-gate.md`.
- Related scope discussion: https://github.com/paperclipai/paperclip/issues/5640.
- Related broader file feature: https://github.com/paperclipai/paperclip/pull/3262.
