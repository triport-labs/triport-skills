# REST, SSE and chain semantics

Tron JSON-RPC is an EVM-compatible read subset; do not assume Ethereum writes,
WebSocket subscriptions or old state reads work. Use wallet REST for native
Tron operations. Address formats and `visible` flags are method-specific:
consult the method page before substituting a base58 address for a hex value.
An ABI call to `triggerconstantcontract` is a REST body, not `eth_call` params.

TON `getTransactions` takes named parameters; paginate with the method's
documented `lt` / hash fields, not an EVM block offset. Preserve large integers
and decimal amount strings. Archive availability depends on the documented window.

Stellar Soroban JSON-RPC and Horizon REST expose different history windows.
Do not send `getEvents` to a Horizon resource or build a JSON-RPC envelope around
a Horizon REST call. SSE uses
`https://triport.io/rpc/stellar/horizon/ledgers?cursor=now` or the documented
transaction resource, an `Accept: text/event-stream` header and the API key header.
Persist a paging token only after processing the event; resume with a saved cursor,
handle SSE framing/keepalives, and reconcile gaps through available Horizon history.
`cursor=now` starts live and intentionally skips prior history.

## REST examples

Complete Node.js 22+ / Python 3.12+ snippets, no external libraries. The first call
is Tron native wallet REST; the second is Stellar Horizon REST. Neither is JSON-RPC.

```ts
const key = process.env.TRIPORT_API_KEY;
if (!key) throw new Error("Set TRIPORT_API_KEY");
const block = await fetch("https://triport.io/rpc/tron/wallet/getnowblock", {
  method: "POST", headers: { "x-token": key, "Content-Type": "application/json" },
  body: "{}", signal: AbortSignal.timeout(15000),
});
if (!block.ok) throw new Error(`Tron HTTP ${block.status}`);
console.log("Tron block", await block.json());
const ledgers = await fetch("https://triport.io/rpc/stellar/horizon/ledgers?order=desc&limit=1", {
  headers: { "x-token": key }, signal: AbortSignal.timeout(15000),
});
if (!ledgers.ok) throw new Error(`Horizon HTTP ${ledgers.status}`);
console.log("Stellar ledgers", await ledgers.json());
export {};
```

```python
import json
import os
from urllib.error import HTTPError
from urllib.request import Request, urlopen

headers = {"x-token": os.environ["TRIPORT_API_KEY"], "Content-Type": "application/json"}
requests = [
    Request("https://triport.io/rpc/tron/wallet/getnowblock", data=b"{}", headers=headers),
    Request("https://triport.io/rpc/stellar/horizon/ledgers?order=desc&limit=1", headers=headers),
]
for request in requests:
    try:
        with urlopen(request, timeout=15) as response:
            print(json.load(response))
    except HTTPError as error:
        raise RuntimeError(f"HTTP {error.code}") from None
```

Sources: [Tron getnowblock](https://triport.io/docs/tron/wallet/getnowblock),
[TON transactions](https://triport.io/docs/ton/json-rpc/getTransactions),
[Horizon ledgers](https://triport.io/docs/stellar/rest/stellarHorizonListLedgers),
[Horizon SSE](https://triport.io/docs/stellar/streams/sse),
[TON limits](https://triport.io/docs/ton/rate-limits-and-tiers),
[Stellar limits](https://triport.io/docs/stellar/rate-limits-and-tiers).
