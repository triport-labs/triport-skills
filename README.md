<p align="center"><img src="https://raw.githubusercontent.com/triport-labs/.github/main/profile/assets/banner-9-networks.png" alt="Triport" width="100%"></p>

# Triport Agent Skills

Seven portable skills for agents building with Triport RPC, Solana streams and
wallet APIs. Each `skills/<name>/SKILL.md` has activation metadata, endpoint
guidance, complete TypeScript/Python examples, error handling and public sources.
Supporting references stay inside the skill so individual folders can be copied.

[Website](https://triport.io) · [Docs](https://triport.io/docs) · [X](https://x.com/triport_io) · [Telegram](https://t.me/triport_dev) · [Email](mailto:sales@triport.io)

## Quick start: Claude Code in under a minute

From a checkout of this repository, copy the skill folders into your personal
skills directory (Bash):

```sh
mkdir -p ~/.claude/skills
cp -R skills/triport-* ~/.claude/skills/
```

On PowerShell:

```powershell
New-Item -ItemType Directory -Force "$HOME/.claude/skills" | Out-Null
Copy-Item -Recurse skills/triport-* "$HOME/.claude/skills/"
```

Restart Claude Code and ask: “Use triport-solana-rpc to paginate a Solana
address history through Triport, with a bounded request budget.” Review existing
folders before copying an updated version over your own customization.

## Claude Code plugin marketplace

This repository is both a plugin and a local marketplace:
[marketplace.json](.claude-plugin/marketplace.json) lists the root plugin, and
[plugin.json](.claude-plugin/plugin.json) lets Claude discover `skills/`.
From this checkout, run:

```sh
claude plugin validate .
claude plugin marketplace add .
claude plugin install triport-skills@triport-labs
```

Inside Claude Code, invoke `/triport-skills:triport-getting-started` or let the
agent select a matching skill. Choose either direct copying or plugin installation
to avoid duplicate skill discovery. Once the repository is published, users can
register `triport-labs/triport-skills` instead of a local path.
See the [official marketplace guide](https://code.claude.com/docs/en/plugin-marketplaces)
and [manifest reference](https://code.claude.com/docs/en/plugins-reference).

## Codex with AGENTS.md

Place this checkout at `.triport-skills/` in the consuming project (for example,
clone the published repository there). Merge the routing text from
[integrations/AGENTS.md](integrations/AGENTS.md) into the project's existing
`AGENTS.md`; keep its other instructions. Start a new Codex session at the project
root. The routing text tells the agent which local SKILL.md to read on matching
tasks; it does not depend on a plugin installer.

Example request: “Use triport-evm-rpc from .triport-skills to scan recent Base
logs in bounded chunks.” See [official AGENTS.md guidance](https://developers.openai.com/codex/guides/agents-md).

## Cursor with .cursor/rules

Keep this checkout at `.triport-skills/` in the project. Copy
[integrations/triport.mdc](integrations/triport.mdc) to
`.cursor/rules/triport.mdc`, preserving existing project rules. Its description
routes relevant tasks to local SKILL.md files; `alwaysApply: false` avoids loading
all seven skills for unrelated work. Ask “Use the Triport rule to build a filtered
pre-execution reader” or select the rule explicitly. Rules use the `.mdc` extension;
see [official Cursor rules](https://cursor.com/docs/rules).

## Skills

| Skill | Use for |
|---|---|
| [triport-getting-started](skills/triport-getting-started/SKILL.md) | Keys, endpoint templates, tiers and pacing |
| [triport-solana-rpc](skills/triport-solana-rpc/SKILL.md) | RPC/PubSub, history, priority fees, signed sends |
| [triport-yellowstone-grpc](skills/triport-yellowstone-grpc/SKILL.md) | Geyser filters, x-token, ping and reconnect backoff |
| [triport-solana-shreds](skills/triport-solana-shreds/SKILL.md) | Pre-execution intent and compact firehose |
| [triport-evm-rpc](skills/triport-evm-rpc/SKILL.md) | Ethereum/Base/BNB/Polygon/Robinhood logs and WS differences |
| [triport-wallet-apis](skills/triport-wallet-apis/SKILL.md) | Identity, watch subscriptions, activity and cursor delivery |
| [triport-other-chains](skills/triport-other-chains/SKILL.md) | Tron, TON and Stellar RPC/REST/SSE |

## Running examples and checks

Set `TRIPORT_API_KEY` in your shell or secret manager. Do not commit it or print
resolved keyed URLs. Copy a complete fenced example into a file. Standard-library
HTTP examples need Node.js 22+ or Python 3.12+. Run TypeScript with
`node --experimental-strip-types example.ts` and Python with `python example.py`.
WS examples need `ws` in Node or `websockets>=14` in Python. Yellowstone examples
need their documented dependencies and pinned protobuf schemas; read their
[setup reference](skills/triport-yellowstone-grpc/reference/schema-and-filters.md).
Follow the variables documented beside each example. Send and watch-creation
examples define functions that mutate only when called intentionally.

For repository validation:

```sh
npm ci --ignore-scripts
npm run check
```

`scripts/validate.mjs` parses YAML, enforces names and length limits, and checks
relative links and heading fragments in every skill Markdown file, including
reference-style links and images. It rejects links escaping an individual skill.
External documentation links are sources, not fetched during CI.
`scripts/check-snippets.mjs` extracts every TypeScript/Python fence, runs
`tsc --noEmit` in strict mode and `python -m py_compile`, then deletes temporary
files. Syntax checks do not establish live behavior, entitlements or importability
of user-generated gRPC modules. CI runs these checks and offline regression tests
without secrets or production API calls.

Public method routes and limits follow the Triport documentation reviewed
2026-10-20; recheck the linked pages before quoting plan limits. In particular,
Base limits contain provisional values, BSC has no published mounted WS stream,
and pending-transaction subscriptions differ by network.
