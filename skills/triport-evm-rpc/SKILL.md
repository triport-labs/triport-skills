---
name: triport-evm-rpc
description: Query Ethereum, Base, BNB Chain, Polygon or Robinhood Chain through Triport EVM RPC; scan eth_getLogs in bounded chunks; subscribe to WSS newHeads; or select a supported pending-transaction source. Use for EVM chain routes, log backfills and subscription capability differences.
---

# Triport EVM RPC

Use for EVM JSON-RPC, bounded log scans and live block/pending subscriptions.
Send `x-token: $TRIPORT_API_KEY`; enable the matching `<chain>:rpc` scope.

| Network id | HTTPS on `https://triport.io` | WSS on `wss://triport.io` | Pending tx |
|---|---|---|---|
| `eth` | `/eth` | `/ws/eth` | `newPendingTransactions`: hash or full object via boolean `true` |
| `base` | `/rpc/base` | `/ws/base` | No general pending subscription published; use documented Flashblocks separately |
| `bsc` | `/rpc/bsc` | No mounted stream published | Do not assume Ethereum WS support |
| `polygon` | `/polygon` | `/ws/poly` | `newPendingTransactions`: hashes only |
| `robinhood` | `/rpc/robinhood` | `/ws/robinhood` | `newPendingTransactions` unavailable; pending-block extension disabled by default |

Keyed HTTPS/WSS templates from `GET /v1/keys/{id}/endpoints` are
`https://triport.io/r/{key}/<chain>` / `wss://triport.io/ws/r/{key}/<chain>`.
Use the returned enabled template verbatim; Base documents `/r/{key}/rpc/base`.
Prefer the header routes above rather than constructing aliases.

Read [WSS and network differences](reference/wss-and-networks.md) for complete
TS/Python subscription examples, tier gates and pending semantics.
Do not use `eth_subscribe` over HTTPS. BSC's published surface is read-only.

## Chunked logs: TypeScript

Node.js 22+, no external runtime libraries. Set `EVM_CHAIN` and `EVM_CONTRACT`.
This example snapshots the head and scans the last three blocks. `LOG_CHUNK`
defaults to one block as a conservative client setting, not a service guarantee.
Wider backfills should use explicit bounds and a measured chunk size; retain
successful progress and shrink only errors identified as range/result limits.

```ts
const paths: Record<string, string> = { eth: "/eth", base: "/rpc/base", bsc: "/rpc/bsc", polygon: "/polygon", robinhood: "/rpc/robinhood" };
const chain = process.env.EVM_CHAIN ?? "eth";
const key = process.env.TRIPORT_API_KEY;
const address = process.env.EVM_CONTRACT;
if (!paths[chain] || !key || !address || !/^0x[\da-fA-F]{40}$/.test(address)) throw new Error("Set a supported EVM_CHAIN, TRIPORT_API_KEY and EVM_CONTRACT");
class RpcError extends Error {
  readonly code: number;
  constructor(code: number, message: string) { super(message); this.code = code; }
}
async function rpc(method: string, params: unknown[]): Promise<any> {
  const response = await fetch(`https://triport.io${paths[chain]}`, {
    method: "POST", headers: { "x-token": key!, "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }), signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const body = await response.json();
  if (body.error) throw new RpcError(body.error.code, body.error.message);
  return body.result;
}
const head = BigInt(await rpc("eth_blockNumber", []));
let from = head > 2n ? head - 2n : 0n;
let chunk = BigInt(process.env.LOG_CHUNK ?? "1");
if (chunk < 1n) throw new Error("LOG_CHUNK must be positive");
while (from <= head) {
  const to = from + chunk - 1n < head ? from + chunk - 1n : head;
  try {
    const logs = await rpc("eth_getLogs", [{ address, fromBlock: `0x${from.toString(16)}`, toBlock: `0x${to.toString(16)}` }]);
    console.log(JSON.stringify({ from: from.toString(), to: to.toString(), logs }));
    from = to + 1n; // Inclusive bounds: advance only after success.
  } catch (error) {
    const rangeLimit = error instanceof RpcError && /(?:range|too many results|response size|block limit)/i.test(error.message);
    if (!rangeLimit || chunk === 1n) throw new Error(error instanceof RpcError ? `RPC ${error.code}: log scan failed` : String(error));
    chunk = chunk / 2n;
  }
}
export {};
```

## Chunked logs: Python

Python 3.12+, standard library. This uses the same inclusive windows and only
advances after success. Transport, authentication and unrelated RPC errors stop.

```python
import json
import os
import re
from urllib.error import HTTPError
from urllib.request import Request, urlopen

paths = {"eth": "/eth", "base": "/rpc/base", "bsc": "/rpc/bsc", "polygon": "/polygon", "robinhood": "/rpc/robinhood"}
chain = os.getenv("EVM_CHAIN", "eth")
address = os.environ["EVM_CONTRACT"]
if chain not in paths or not re.fullmatch(r"0x[\da-fA-F]{40}", address):
    raise ValueError("Set a supported EVM_CHAIN and EVM_CONTRACT")

class RpcError(Exception):
    def __init__(self, code, message):
        self.code = code
        self.message = message
        super().__init__(f"RPC {code}")

def rpc(method, params):
    request = Request("https://triport.io" + paths[chain],
        data=json.dumps({"jsonrpc": "2.0", "id": 1, "method": method, "params": params}).encode(),
        headers={"x-token": os.environ["TRIPORT_API_KEY"], "Content-Type": "application/json"})
    try:
        with urlopen(request, timeout=15) as response:
            body = json.load(response)
    except HTTPError as error:
        raise RuntimeError(f"HTTP {error.code}") from None
    if body.get("error"):
        raise RpcError(body["error"]["code"], body["error"]["message"])
    return body["result"]

head = int(rpc("eth_blockNumber", []), 16)
start = max(0, head - 2)
chunk = int(os.getenv("LOG_CHUNK", "1"))
if chunk < 1:
    raise ValueError("LOG_CHUNK must be positive")
while start <= head:
    end = min(head, start + chunk - 1)
    try:
        logs = rpc("eth_getLogs", [{"address": address, "fromBlock": hex(start), "toBlock": hex(end)}])
        print(json.dumps({"from": start, "to": end, "logs": logs}))
        start = end + 1
    except RpcError as error:
        if chunk == 1 or not re.search(r"range|too many results|response size|block limit", error.message, re.I):
            raise RuntimeError(f"RPC {error.code}: log scan failed") from None
        chunk //= 2
```

Persist logs with `(blockHash, transactionHash, logIndex)` and retain the block
hash alongside the progress cursor. Reconcile non-finalized ranges after reorgs;
an empty log result does not prove arbitrary archive coverage. `blockHash` and
`fromBlock`/`toBlock` are mutually exclusive.

## Common errors

- **401:** check key expiry/revocation and the header. **403** may indicate scope,
  tier or an unsupported method. Changing batch size cannot fix authorization.
- **429:** honor `Retry-After`, pace by category and bound retries. Do not split
  into parallel requests as a rate-limit workaround.
- **-32601:** verify network method catalog and transport. Pending subscriptions
  supported on Ethereum are not portable to Base/BSC/Robinhood.
- **Range errors:** halve the current chunk only for a recognized range/result
  limit, stop at one block, and surface archive/schema failures. Do not treat a
  pruned/unsupported history error as an empty result or silently skip blocks.

## Documentation

[Ethereum](https://triport.io/docs/eth), [Base](https://triport.io/docs/base),
[BSC](https://triport.io/docs/bsc), [Polygon](https://triport.io/docs/polygon),
[Robinhood](https://triport.io/docs/robinhood),
[eth_getLogs](https://triport.io/docs/eth/json-rpc/eth_getLogs),
[limits](https://triport.io/docs/rate-limits-and-tiers).
