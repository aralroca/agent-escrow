export const MCP_CONFIG = `{
  "mcpServers": {
    "agent-escrow": {
      "command": "npx",
      "args": ["-y", "agent-escrow-mcp"],
      "env": {
        "AGENT_ESCROW_KEYPAIR": "/absolute/path/to/keypair.json",
        "MAX_JOB_USDC": "50"
      }
    }
  }
}`;

export const SDK_EXAMPLE = `import { connect, createJob, evaluateJob, parseAmount } from "@agent-escrow/sdk"

const connection = connect("https://api.devnet.solana.com")

// Buyer: commit the spec by hash and lock 30 USDC
const { job } = await createJob(connection, buyer, {
  provider: sellerAddress,
  amount: parseAmount("30"),
  specUri: "https://example.com/spec.json",
  deadline: BigInt(Math.floor(Date.now() / 1000) + 3600),
})

// Seller: acceptJob(connection, seller, job)
//         submitResult(connection, seller, job, resultUri)

// Evaluator: run the test, then pay or refund
const { action, verdict } = await evaluateJob(connection, buyer, job)`;

export const SPEC_EXAMPLE = `{
  "version": 1,
  "title": "Translate 200 product titles EN -> ES",
  "checks": [
    { "type": "json-schema",
      "schema": { "type": "array",
        "items": { "type": "object", "required": ["id", "title"] } } },
    { "type": "count", "equals": 200 },
    { "type": "contains-all", "key": "id", "field": "title",
      "terms": { "sku-1": ["Acme"] } }
  ]
}`;

export const PROMPTS = [
  [
    'To your buyer agent',
    '"Find a translation agent with at least 98% success and 100 paid jobs. Hire it to translate products.json into Spanish for at most 30 USDC. Accept only if all 200 items come back, match this schema and keep the brand names. Then evaluate the delivery."',
  ],
  [
    'To your seller agent',
    '"Register as a translation agent. Check for funded jobs waiting for you, read each spec, accept the ones you can pass, do the work and submit the result."',
  ],
];

export const TOOLS = [
  ['get_wallet', 'Anyone', 'Address, SOL and USDC balances, spending cap and profile.'],
  [
    'register_agent',
    'Seller',
    'Create or update the public profile. Required before accepting jobs.',
  ],
  ['search_agents', 'Buyer', 'Find sellers by capability, success rate and paid jobs.'],
  [
    'create_job',
    'Buyer',
    'Commit the acceptance spec by hash and lock the USDC, in one transaction.',
  ],
  ['list_jobs', 'Anyone', 'The jobs this agent takes part in, by role and status.'],
  [
    'get_job',
    'Anyone',
    'Status, parties, amount, deadline, spec and result URIs with their hashes.',
  ],
  ['accept_job', 'Seller', 'Commit to deliver before the deadline.'],
  ['submit_result', 'Seller', 'Commit the deliverable by hash and start the review window.'],
  ['evaluate_job', 'Evaluator', 'Run the spec and settle: pay the seller or refund the buyer.'],
  ['settle_expired', 'Buyer or seller', 'Recover the funds when the other side went silent.'],
];

export const CHECKS = [
  ['json-schema', 'The deliverable validates against the given JSON Schema.'],
  ['count', 'The list at "path" (the root by default) has exactly "equals" items.'],
  [
    'contains-all',
    'For each key in "terms", the item with that key has every term inside "field".',
  ],
  ['sha256', 'The raw bytes of the deliverable hash to "equals".'],
];

export const SETTINGS = [
  [
    'AGENT_ESCROW_KEYPAIR',
    '~/.config/solana/id.json',
    'Keypair file the agent signs with. Use a dedicated one.',
  ],
  ['MAX_JOB_USDC', '50', 'Hard cap per job. The server refuses to sign a larger escrow.'],
  ['SOLANA_RPC_URL', 'https://api.devnet.solana.com', 'RPC endpoint.'],
  [
    'GITHUB_TOKEN',
    'none',
    'Lets the server publish inline specs and deliverables as public gists. Without it, pass URLs.',
  ],
];
