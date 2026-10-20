---
name: triport-other-chains
description: "Integrate Tron, TON or Stellar through Triport: choose Tron JSON-RPC versus wallet REST, use named TON parameters, separate Stellar Soroban RPC from Horizon REST/SSE, and diagnose chain-specific route or method errors. Use when the target chain is Tron, TON or Stellar rather than Solana or EVM subscriptions."
---

# Triport Tron, TON and Stellar

Use for these three networks; preserve each protocol's request shape.
Authenticate with `x-token: $TRIPORT_API_KEY` and the chain's scope
(`tron:rpc`, `ton:rpc`, `stellar:rpc`).

| Surface | Endpoint | Shape |
|---|---|---|
| Tron JSON-RPC | `https://triport.io/rpc/tron` | EVM-compatible read subset, positional params |
| Tron wallet REST | `https://triport.io/rpc/tron/wallet/<method>` | Method-specific REST JSON body |
| TON JSON-RPC | `https://triport.io/rpc/ton` | Named `params` object |
| Stellar Soroban RPC | `https://triport.io/rpc/stellar` | Named `params` object |
| Stellar Horizon REST/SSE | `https://triport.io/rpc/stellar/horizon` | HTTP resources / SSE, not JSON-RPC |

Keyed HTTPS uses the enabled discovery template
`https://triport.io/r/{key}/<chain>`; prefer header routes for backend clients.
There is no published general WSS route for these chains. Stellar streams use
Horizon SSE. Do not infer `eth_subscribe` support from Tron read compatibility.

## TypeScript

Node.js 22+, no external libraries. Three tiny read-only RPC checks demonstrate
the different parameter shapes. Choose only the network needed in real usage.

```ts
const key = process.env.TRIPORT_API_KEY;
if (!key) throw new Error("Set TRIPORT_API_KEY");
const checks: { chain: string; method: string; params: unknown[] | Record<string, unknown> }[] = [
  { chain: "tron", method: "eth_blockNumber", params: [] },
  { chain: "ton", method: "getMasterchainInfo", params: {} },
  { chain: "stellar", method: "getHealth", params: {} },
];
for (const check of checks) {
  const response = await fetch(`https://triport.io/rpc/${check.chain}`, {
    method: "POST", headers: { "x-token": key, "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: check.method, params: check.params }),
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) throw new Error(`${check.chain}: HTTP ${response.status}`);
  const body = await response.json();
  if (body.error) throw new Error(`${check.chain}: RPC ${body.error.code}`);
  console.log(check.chain, body.result);
}
export {};
```

## Python

Python 3.12+, standard library. Errors omit request headers and resolved URLs.

```python
import json
import os
from urllib.error import HTTPError
from urllib.request import Request, urlopen

checks = [("tron", "eth_blockNumber", []), ("ton", "getMasterchainInfo", {}),
          ("stellar", "getHealth", {})]
for chain, method, params in checks:
    body = {"jsonrpc": "2.0", "id": 1, "method": method, "params": params}
    request = Request(f"https://triport.io/rpc/{chain}", data=json.dumps(body).encode(),
        headers={"x-token": os.environ["TRIPORT_API_KEY"], "Content-Type": "application/json"})
    try:
        with urlopen(request, timeout=15) as response:
            result = json.load(response)
    except HTTPError as error:
        raise RuntimeError(f"{chain}: HTTP {error.code}") from None
    if result.get("error"):
        raise RuntimeError(f"{chain}: RPC {result['error']['code']}")
    print(chain, result["result"])
```

Read [REST, SSE and chain semantics](reference/protocols.md) for Tron wallet
REST and Stellar Horizon snippets, archive limitations and cursor handling.

## Common errors

- **401:** check `x-token`, trial/subscription expiry and revocation. **403**
  may mean the chain scope or method tier is missing; inspect the error body.
- **429:** honor `Retry-After`, pace sustained per-category RPS and bound
  retries. Documented default budgets for these chains are unmeasured policy;
  they are not capacity guarantees.
- **-32601:** check the selected network catalog. TON/Soroban methods are not
  EVM methods; Tron wallet REST names are not JSON-RPC method aliases.
- **-32602:** TON and Soroban require named objects, including `{}` for the
  no-argument checks above. Do not use an empty positional array there.
- Historical state/ledger-window errors need a supported range, not blind
  retries. Keep unavailable history distinct from an empty successful result.

## Documentation

[Tron](https://triport.io/docs/tron), [TON](https://triport.io/docs/ton),
[Stellar](https://triport.io/docs/stellar),
[TON masterchain](https://triport.io/docs/ton/json-rpc/getMasterchainInfo),
[Stellar health](https://triport.io/docs/stellar/json-rpc/getHealth),
[limits](https://triport.io/docs/rate-limits-and-tiers),
[errors](https://triport.io/docs/errors).
