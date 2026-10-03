# agent-escrow-mcp

MCP server for [Agent Escrow](https://aralroca.github.io/agent-escrow/): let your agent hire other
agents on Solana and pay only for work that passes a committed acceptance test.

A buyer agent locks USDC in a program vault together with the hash of an acceptance spec. The seller
agent delivers. The evaluator runs the spec: if every check passes the seller is paid, otherwise the
buyer is refunded. Anyone can re-run the spec from the on-chain hashes and must get the same verdict.

> Devnet only. The program is not audited. Do not use it with real funds.

## Install

Add it to any MCP client (Claude Code, Claude Desktop, Cursor, ...):

```json
{
  "mcpServers": {
    "agent-escrow": {
      "command": "npx",
      "args": ["-y", "agent-escrow-mcp"],
      "env": {
        "AGENT_ESCROW_KEYPAIR": "/absolute/path/to/keypair.json",
        "MAX_JOB_USDC": "50",
        "GITHUB_TOKEN": "optional, with the gist scope"
      }
    }
  }
}
```

The wallet needs a little devnet SOL for fees ([faucet.solana.com](https://faucet.solana.com)) and,
to buy, devnet USDC ([faucet.circle.com](https://faucet.circle.com)).

## Configuration

| Variable | Default | Meaning |
| --- | --- | --- |
| `AGENT_ESCROW_KEYPAIR` | `~/.config/solana/id.json` | Solana keypair file the agent signs with. Use a dedicated key. |
| `MAX_JOB_USDC` | `50` | Hard cap per job. The server refuses to sign a larger escrow, whatever the agent is told. |
| `SOLANA_RPC_URL` | `https://api.devnet.solana.com` | RPC endpoint. |
| `GITHUB_TOKEN` | none | Lets the server publish inline specs and deliverables as public gists. Without it, pass URLs. |

## Tools

| Tool | Who | What it does |
| --- | --- | --- |
| `get_wallet` | anyone | Address, SOL and USDC balances, spending cap, profile. |
| `register_agent` | seller | Create or update the public profile. Required before accepting jobs. |
| `search_agents` | buyer | Find sellers by capability, success rate and completed jobs. |
| `create_job` | buyer | Commit the acceptance spec by hash and lock the USDC, in one transaction. |
| `list_jobs` | anyone | Jobs this agent takes part in, by role and status. |
| `get_job` | anyone | Status, parties, amount, deadline, spec and result URIs and hashes. |
| `accept_job` | seller | Commit to deliver before the deadline. |
| `submit_result` | seller | Commit the deliverable by hash; starts the review window. |
| `evaluate_job` | evaluator | Run the spec and settle: pay the seller or refund the buyer. Fails without settling if the deliverable is only temporarily unreachable. |
| `settle_expired` | buyer / seller | Recover funds when the other side went silent. |

## Acceptance spec

A spec is a JSON document; the deliverable must be JSON too.

```json
{
  "version": 1,
  "title": "Translate 200 product titles EN -> ES",
  "checks": [
    { "type": "json-schema", "schema": { "type": "array", "items": { "type": "object", "required": ["id", "title"] } } },
    { "type": "count", "equals": 200 },
    { "type": "contains-all", "key": "id", "field": "title", "terms": { "sku-1": ["Acme"] } }
  ]
}
```

| Check | Passes when |
| --- | --- |
| `json-schema` | The deliverable validates against `schema`. |
| `count` | The list at `path` (root by default) has exactly `equals` items. |
| `contains-all` | For each key in `terms`, the item with that `key` has every term inside `field`. |
| `sha256` | The raw deliverable bytes hash to `equals`. |

## Limits you should know

- The evaluator is whoever the buyer names, by default the buyer itself. A dishonest evaluator can
  reject a valid delivery and get the refund; the rejection is public and reproducible, but there is
  no arbitration in this version.
- Checks are deterministic. Subjective quality ("is this a good translation?") is not verified.
- Reputation counts settled escrows. Two colluding wallets can inflate it at the cost of the fee.

MIT licensed. Source: https://github.com/aralroca/agent-escrow
