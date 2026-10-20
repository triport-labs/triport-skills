---
name: triport-solana-rpc
description: Build or debug Solana JSON-RPC and WebSocket integrations through Triport, paginate an address transaction history, estimate priority fees, simulate or submit an already-signed transaction, or track its confirmation. Use for Solana RPC methods and Pub/Sub, not Yellowstone or pre-execution feeds.
---

# Triport Solana RPC

Use for Solana account reads, address history, priority fees and transaction submission.
HTTPS: `https://triport.io/sol`, with `x-token: $TRIPORT_API_KEY`.
Keyed HTTPS: `https://triport.io/r/{key}/sol`.
Pub/Sub: `wss://triport.io/ws/sol`, with the header on upgrade, or the
dashboard template `wss://triport.io/ws/r/{key}/sol`. Keep resolved URLs out of logs.
The key needs Solana access (`solana:rpc`).

Use `getSignaturesForAddress` newest-first with the last signature as the next
`before` cursor. Fetch payloads with `getTransaction` and
`maxSupportedTransactionVersion: 0`; null means unavailable at that commitment,
not necessarily an invalid signature. Bound pages and pace requests by category.

## History and fees: TypeScript / Python

These complete read-only snippets use Node.js 22+ / Python 3.12+ and no external
libraries. Page size and page count are example workload bounds, not service limits.

```ts
const key = process.env.TRIPORT_API_KEY;
if (!key) throw new Error("Set TRIPORT_API_KEY");
async function rpc(method: string, params: unknown[]): Promise<any> {
  const response = await fetch("https://triport.io/sol", {
    method: "POST", headers: { "x-token": key!, "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const body = await response.json();
  if (body.error) throw new Error(`RPC ${body.error.code}`);
  return body.result;
}
const address = process.env.SOL_ADDRESS ?? "So11111111111111111111111111111111111111112";
let before: string | undefined;
for (let page = 0; page < 2; page++) {
  const rows: { signature: string; err: unknown }[] = await rpc(
    "getSignaturesForAddress", [address, { limit: 5, commitment: "confirmed", ...(before ? { before } : {}) }]);
  if (!rows.length) break;
  console.log(rows.map(row => ({ signature: row.signature, failed: row.err !== null })));
  before = rows.at(-1)!.signature;
}
const fees: { prioritizationFee: number }[] = await rpc("getRecentPrioritizationFees", [[address]]);
const sorted = fees.map(row => row.prioritizationFee).sort((a, b) => a - b);
console.log("median micro-lamports/CU", sorted[Math.floor(sorted.length / 2)] ?? 0);
export {};
```

```python
import json
import os
from urllib.error import HTTPError
from urllib.request import Request, urlopen

def rpc(method, params):
    request = Request("https://triport.io/sol",
        data=json.dumps({"jsonrpc": "2.0", "id": 1, "method": method, "params": params}).encode(),
        headers={"x-token": os.environ["TRIPORT_API_KEY"], "Content-Type": "application/json"})
    try:
        with urlopen(request, timeout=15) as response:
            body = json.load(response)
    except HTTPError as error:
        raise RuntimeError(f"HTTP {error.code}") from None
    if body.get("error"):
        raise RuntimeError(f"RPC {body['error']['code']}")
    return body["result"]

address = os.getenv("SOL_ADDRESS", "So11111111111111111111111111111111111111112")
before = None
for _ in range(2):
    config = {"limit": 5, "commitment": "confirmed"}
    if before:
        config["before"] = before
    rows = rpc("getSignaturesForAddress", [address, config])
    if not rows:
        break
    print([{"signature": row["signature"], "failed": row["err"] is not None} for row in rows])
    before = rows[-1]["signature"]
fees = sorted(row["prioritizationFee"] for row in rpc("getRecentPrioritizationFees", [[address]]))
print("median micro-lamports/CU", fees[len(fees) // 2] if fees else 0)
```

The fee estimate is in **micro-lamports per compute unit**, not total lamports.
Apply it through a ComputeBudget instruction before signing. Preserve the user's
fee budget; an observed fee is not a landing guarantee.

For actual sends and subscriptions read
[transaction submission and Pub/Sub](reference/send-and-ws.md). Only submit a
transaction the user intends to broadcast. Keep preflight enabled by default;
`sendTransaction` returns acceptance, then confirm separately. Do not build,
sign or send transfers merely to test connectivity.

## Common errors

- **401:** check the key, trial/subscription expiry and revocation. Do not loop.
- **429:** honor `Retry-After`, bound retries and reduce request concurrency.
  Reads, heavy reads and sends have different budgets; batch elements count separately.
- **-32601:** verify spelling and Solana method support. `eth_*` and
  `eth_subscribe` belong to EVM, not Solana. Pub/Sub methods require WSS.
- **-32602:** check public keys, encodings, commitment and transaction version.
- **-32002:** inspect simulation/preflight failure; fix the signed message rather
  than bypassing preflight. An expired blockhash needs rebuilding and re-signing.

## Documentation

[Solana](https://triport.io/docs/sol),
[address history](https://triport.io/docs/sol/json-rpc/getSignaturesForAddress),
[priority fees](https://triport.io/docs/sol/json-rpc/getRecentPrioritizationFees),
[sendTransaction](https://triport.io/docs/sol/json-rpc/sendTransaction),
[Pub/Sub](https://triport.io/docs/streaming/sol-pubsub),
[limits](https://triport.io/docs/rate-limits-and-tiers),
[errors](https://triport.io/docs/errors).
