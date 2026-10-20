# WSS and network differences

Ethereum `/ws/eth` and Polygon `/ws/poly` support `newHeads` (Pro), `logs`
(Basic), `newPendingTransactions` (Free) and `syncing` (Pro). Polygon's long
`/ws/polygon` path is documented as unavailable. Ethereum full pending bodies use
`["newPendingTransactions", true]`; an `includeFullTx` object is not supported.
Polygon always produces pending hashes.

Base `/ws/base` publishes `newHeads` from Basic and needs `base:ws`; use logs
polling for contract events. Robinhood `/ws/robinhood` supports `newHeads` and
`logs` from Basic with `robinhood:rpc`. `newPendingTransactions` is unavailable.
Its `robinhood_pendingBlock` extension is operator-controlled and disabled by
default (`-32601`); it is a changing assembling-block snapshot, not a mempool
or finality signal. BSC has no mounted WS stream published.

## TypeScript

Install `ws` and `@types/ws`. Select `EVM_CHAIN=eth|polygon|base|robinhood` and
`EVM_TOPIC=newHeads|newPendingTransactions`. This sample validates capabilities,
waits for acknowledgements, receives one notification and closes. The client
deadline prevents hanging on an unsupported/unacknowledged request.

```ts
import WebSocket from "ws";
const chain = process.env.EVM_CHAIN ?? "eth";
const topic = process.env.EVM_TOPIC ?? "newHeads";
const paths: Record<string, string> = { eth: "/ws/eth", polygon: "/ws/poly", base: "/ws/base", robinhood: "/ws/robinhood" };
const key = process.env.TRIPORT_API_KEY;
if (!key || !paths[chain]) throw new Error("Set TRIPORT_API_KEY and a supported WS chain");
if (!["newHeads", "newPendingTransactions"].includes(topic) || (topic === "newPendingTransactions" && !["eth", "polygon"].includes(chain))) throw new Error("Topic not published for this network");
const params: unknown[] = [topic];
if (chain === "eth" && topic === "newPendingTransactions" && process.env.FULL_PENDING === "1") params.push(true);
const ws = new WebSocket(`wss://triport.io${paths[chain]}`, { headers: { "x-token": key } });
let subscription: string | undefined;
const timer = setTimeout(() => ws.close(), 20000);
ws.on("open", () => ws.send(JSON.stringify({ jsonrpc: "2.0", id: 1, method: "eth_subscribe", params })));
ws.on("message", raw => {
  const message = JSON.parse(raw.toString());
  if (message.error) { console.error("subscription rejected"); ws.close(); return; }
  if (message.id === 1) subscription = message.result;
  if (message.method === "eth_subscription" && message.params.subscription === subscription) {
    console.log(message.params.result);
    ws.send(JSON.stringify({ jsonrpc: "2.0", id: 2, method: "eth_unsubscribe", params: [subscription] }));
    ws.close();
  }
});
ws.on("error", () => { console.error("WebSocket connection failed"); ws.close(); });
ws.on("close", () => clearTimeout(timer));
```

## Python

Install `websockets>=14`. Pending observations can disappear without confirmation;
transaction-body reads may return null. Never treat a pending event as execution.

```python
import asyncio
import json
import os
from websockets.asyncio.client import connect

async def main():
    chain = os.getenv("EVM_CHAIN", "eth")
    topic = os.getenv("EVM_TOPIC", "newHeads")
    paths = {"eth": "/ws/eth", "polygon": "/ws/poly", "base": "/ws/base", "robinhood": "/ws/robinhood"}
    if chain not in paths or topic not in ("newHeads", "newPendingTransactions"):
        raise ValueError("Unsupported WS chain or topic")
    if topic == "newPendingTransactions" and chain not in ("eth", "polygon"):
        raise ValueError("Pending subscription not published for this network")
    params = [topic]
    if chain == "eth" and topic == "newPendingTransactions" and os.getenv("FULL_PENDING") == "1":
        params.append(True)
    async with asyncio.timeout(20):
        async with connect("wss://triport.io" + paths[chain], additional_headers={"x-token": os.environ["TRIPORT_API_KEY"]}) as ws:
            await ws.send(json.dumps({"jsonrpc": "2.0", "id": 1, "method": "eth_subscribe", "params": params}))
            subscription = None
            async for raw in ws:
                message = json.loads(raw)
                if message.get("error"):
                    raise RuntimeError("Subscription rejected")
                if message.get("id") == 1:
                    subscription = message["result"]
                if message.get("method") == "eth_subscription" and message["params"]["subscription"] == subscription:
                    print(message["params"]["result"])
                    await ws.send(json.dumps({"jsonrpc": "2.0", "id": 2, "method": "eth_unsubscribe", "params": [subscription]}))
                    break

if __name__ == "__main__":
    asyncio.run(main())
```

## Reconciliation

Reconnect with bounded exponential backoff and jitter; recreate subscriptions and
discard old subscription IDs. Use saved block hashes to detect reorgs and RPC
reads / log scans to fill gaps. A notification stream is not a durable journal.

No universal numeric `eth_getLogs` range ceiling applies across these networks.
The BSC and Base guides describe per-node differences; Base's frozen parameter
ceiling is unknown, so a broad historical request needs verified support. The
one-block sample is a conservative request, not a promise of history availability.

Sources: [Ethereum WS](https://triport.io/docs/streaming/eth-ws),
[Polygon WS](https://triport.io/docs/streaming/poly-ws),
[Base WS](https://triport.io/docs/base/ws),
[Robinhood WS](https://triport.io/docs/robinhood/ws),
[BSC limits](https://triport.io/docs/bsc/limits),
[Base logs](https://triport.io/docs/base/json-rpc/eth_getLogs).
