---
name: triport-wallet-apis
description: Resolve Triport cross-chain wallet identity, create or consume wallet watch subscriptions, process wallet_activity events, resume event cursors, or handle reorgs and coverage gaps. Use for /v1/wallet identity/activity/watch product APIs rather than ordinary chain balance RPC or console wallet login.
---

# Triport wallet identity, activity and watch

Use for cross-chain EVM identity and monitored wallet events. These APIs are
separate from console wallet login and from Solana base58 wallet REST.

| Operation | Endpoint |
|---|---|
| Identity | `GET https://triport.io/v1/wallet/{0x-address}/identity` |
| Watch subscriptions | `POST` / `GET https://triport.io/v1/wallet/watch` |
| Update/delete a subscription | `PATCH` / `DELETE https://triport.io/v1/wallet/watch/{id}` |
| Activity replay | `GET https://triport.io/v1/wallet/watch/{id}/events?cursor=…` |
| Coverage | `GET https://triport.io/v1/wallet/watch/coverage` |
| Live watch | `wss://triport.io/ws/wallet-watch?id=<id>&cursor=<cursor>` |

Authenticate with `x-token: $TRIPORT_API_KEY` or Bearer. Watch requires an
account-owned dashboard key; static tokens return `401 account_required`.
Identity and watch start at Business. Consult the linked method docs for current
limits rather than inferring them from chain RPC budgets.

Identity accepts an EVM address and `chains=eth,base,polygon,bsc,robinhood,tron`;
Tron is derived from the EVM identity. Watch monitors the five EVM networks, **not
Tron**. `wallet_activity` is an event type inside watch, not an invented standalone
`/activity` endpoint. It requires a non-empty `watchlist`.

## TypeScript

Node.js 22+, no external libraries. Set `WALLET_ADDRESS`; optionally set `SUB_ID`
and a saved `WATCH_CURSOR` to inspect one page of an existing subscription.
These examples read only and do not create subscriptions.

```ts
const key = process.env.TRIPORT_API_KEY;
const address = process.env.WALLET_ADDRESS;
if (!key || !address || !/^0x[\da-fA-F]{40}$/.test(address)) throw new Error("Set TRIPORT_API_KEY and WALLET_ADDRESS");
async function read(path: string): Promise<any> {
  const response = await fetch(`https://triport.io${path}`, {
    headers: { "x-token": key! }, signal: AbortSignal.timeout(30000),
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}
const identity = await read(`/v1/wallet/${address}/identity?chains=eth,base&fields=names,balances,activity,labels`);
console.log(JSON.stringify({ names: identity.names, chains: identity.chains, unresolved: identity.unresolved }));
if (process.env.SUB_ID) {
  const query = new URLSearchParams({ limit: "100" });
  if (process.env.WATCH_CURSOR) query.set("cursor", process.env.WATCH_CURSOR);
  const page = await read(`/v1/wallet/watch/${encodeURIComponent(process.env.SUB_ID)}/events?${query}`);
  console.log(JSON.stringify({ events: page.events, next_cursor: page.next_cursor, has_more: page.has_more }));
}
export {};
```

## Python

Python 3.12+, standard library; same environment variables. An HTTP 200 identity
can still contain per-chain errors and unresolved names; inspect both.

```python
import json
import os
import re
from urllib.error import HTTPError
from urllib.parse import quote, urlencode
from urllib.request import Request, urlopen

address = os.environ["WALLET_ADDRESS"]
if not re.fullmatch(r"0x[\da-fA-F]{40}", address):
    raise ValueError("WALLET_ADDRESS must be an EVM address")

def read(path):
    request = Request("https://triport.io" + path, headers={"x-token": os.environ["TRIPORT_API_KEY"]})
    try:
        with urlopen(request, timeout=30) as response:
            return json.load(response)
    except HTTPError as error:
        raise RuntimeError(f"HTTP {error.code}") from None

identity = read(f"/v1/wallet/{address}/identity?chains=eth,base&fields=names,balances,activity,labels")
print(json.dumps({"names": identity.get("names"), "chains": identity.get("chains"), "unresolved": identity.get("unresolved")}))
if os.getenv("SUB_ID"):
    query = {"limit": "100"}
    if os.getenv("WATCH_CURSOR"):
        query["cursor"] = os.environ["WATCH_CURSOR"]
    page = read(f"/v1/wallet/watch/{quote(os.environ['SUB_ID'], safe='')}/events?{urlencode(query)}")
    print(json.dumps({"events": page["events"], "next_cursor": page["next_cursor"], "has_more": page["has_more"]}))
```

For creation and durable consumption, read
[watch lifecycle and delivery](reference/watch-lifecycle.md). Keep raw amounts as
decimal strings / integers, not floating point. Enrichment is partial and can be
skipped; do not infer identity or complete activity from absent fields.

## Common errors

- **401:** distinguish invalid/expired credentials from `account_required`;
  for the latter create an account-owned dashboard key.
- **429:** honor `Retry-After`, bound retries and pace the `wallet_identity`
  bucket. Identity may additionally charge internal per-network RPC reads.
- **-32601:** these REST/WS product routes do not accept JSON-RPC methods.
  Use the documented HTTP verbs; do not send `eth_subscribe` to wallet-watch.
- **403:** `tier_insufficient` or `subscription_limit` needs a plan/capacity
  change, not retries. **410 / WS 4410** means the cursor expired: report an
  unrecoverable gap before explicitly selecting a new resume point.

## Documentation

[Identity](https://triport.io/docs/platform/wallet-identity),
[activity](https://triport.io/docs/platform/wallet-activity),
[watch](https://triport.io/docs/platform/wallet-watch),
[filters](https://triport.io/docs/platform/wallet-identity-filters),
[limits](https://triport.io/docs/rate-limits-and-tiers),
[errors](https://triport.io/docs/errors).
