# Submission and Pub/Sub

The send functions below require canonical base64 **wire bytes** of an already
signed transaction with a recent blockhash. They are functions only: calling them
broadcasts. Never pass `tx_pb_base64` from the shred stream. Simulate first using
`simulateTransaction` with `encoding: base64` and the intended commitment.
Use `getLatestBlockhash` before signing and retain `lastValidBlockHeight`.
After an ambiguous send timeout, query the known signature before considering
resubmission; do not automatically rebuild a transfer with a fresh signature.

## TypeScript

```ts
export async function sendSigned(wireBase64: string): Promise<string> {
  const key = process.env.TRIPORT_API_KEY;
  if (!key) throw new Error("Set TRIPORT_API_KEY");
  const response = await fetch("https://triport.io/sol", {
    method: "POST", headers: { "x-token": key, "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "sendTransaction",
      params: [wireBase64, { encoding: "base64", skipPreflight: false, preflightCommitment: "confirmed" }] }),
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const body = await response.json();
  if (body.error) throw new Error(`RPC ${body.error.code}`);
  return body.result;
}
```

## Python

```python
import json
import os
from urllib.error import HTTPError
from urllib.request import Request, urlopen

def send_signed(wire_base64):
    body = {"jsonrpc": "2.0", "id": 1, "method": "sendTransaction", "params": [wire_base64,
            {"encoding": "base64", "skipPreflight": False, "preflightCommitment": "confirmed"}]}
    request = Request("https://triport.io/sol", data=json.dumps(body).encode(),
        headers={"x-token": os.environ["TRIPORT_API_KEY"], "Content-Type": "application/json"})
    try:
        with urlopen(request, timeout=15) as response:
            result = json.load(response)
    except HTTPError as error:
        raise RuntimeError(f"HTTP {error.code}") from None
    if result.get("error"):
        raise RuntimeError(f"RPC {result['error']['code']}")
    return result["result"]
```

Poll the catalogued `getTransaction` method to retrieve the eventual payload with
`[signature,{"encoding":"json","commitment":"confirmed","maxSupportedTransactionVersion":0}]`.
Check `meta.err` and the requested commitment; null is not confirmation. Bound
polling by the retained expiry height, queried via `getBlockHeight`, and the
user's timeout. Use `finalized` if the task needs finality rather than confirmation.

## Pub/Sub examples

Install `ws` for Node (plus `@types/ws` to typecheck), or `websockets>=14` for
Python. These examples receive one update and close. Use a continuous reader in
production, reconnect with bounded exponential backoff and resubscribe with fresh
subscription IDs. There is no automatic replay: reconcile missed history via RPC.

```ts
import WebSocket from "ws";
const key = process.env.TRIPORT_API_KEY;
if (!key) throw new Error("Set TRIPORT_API_KEY");
const ws = new WebSocket("wss://triport.io/ws/sol", { headers: { "x-token": key } });
const timer = setTimeout(() => ws.close(), 20000);
ws.on("open", () => ws.send(JSON.stringify({ jsonrpc: "2.0", id: 1, method: "slotSubscribe", params: [] })));
ws.on("message", raw => {
  const message = JSON.parse(raw.toString());
  if (message.error) { console.error("RPC", message.error.code); ws.close(); }
  if (message.method === "slotNotification") { console.log(message.params.result); ws.close(); }
});
ws.on("error", () => { console.error("WebSocket connection failed"); ws.close(); });
ws.on("close", () => clearTimeout(timer));
```

```python
import asyncio
import json
import os
from websockets.asyncio.client import connect

async def main():
    async with asyncio.timeout(20):
        async with connect("wss://triport.io/ws/sol",
                           additional_headers={"x-token": os.environ["TRIPORT_API_KEY"]}) as ws:
            await ws.send(json.dumps({"jsonrpc": "2.0", "id": 1, "method": "slotSubscribe", "params": []}))
            async for raw in ws:
                message = json.loads(raw)
                if message.get("error"):
                    raise RuntimeError(f"RPC {message['error']['code']}")
                if message.get("method") == "slotNotification":
                    print(message["params"]["result"])
                    break

if __name__ == "__main__":
    asyncio.run(main())
```

[Send reference](https://triport.io/docs/sol/json-rpc/sendTransaction),
[simulation](https://triport.io/docs/sol/json-rpc/simulateTransaction),
[Pub/Sub](https://triport.io/docs/streaming/sol-pubsub).
