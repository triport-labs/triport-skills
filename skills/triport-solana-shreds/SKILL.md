---
name: triport-solana-shreds
description: Consume Triport Solana shred/pre-execution WebSocket transactions or the compact non-vote firehose, choose an account filter, parse tx_pb_base64, and reconcile execution outcomes or dropped frames. Use for /ws/sol-preexec and /ws/sol-stream, not native Yellowstone subscriptions or ordinary Solana Pub/Sub.
---

# Triport Solana shreds and firehose

Use when a task asks for shred, deshred, pre-execution or firehose ingestion.
Choose the surface by the data needed:

| Surface | Endpoint | What arrives |
|---|---|---|
| Shreds / pre-execution | `wss://triport.io/ws/sol-preexec?accounts=<pubkey>` | Reassembled transactions **before execution**, JSON by default |
| Firehose | `wss://triport.io/ws/sol-stream` | Compact non-vote transaction and stats frames, no client filters |

Both require Pro or above and accept `x-token: $TRIPORT_API_KEY` on upgrade.
Pre-execution additionally needs scope `sol.preexec`. On Pro its `accounts`
filter is required; use the user's account/program list. Business may omit it.
Read [formats and recovery](reference/formats-and-recovery.md) for sourced filter
and concurrency caps, close codes and delivery semantics.

Pre-execution is an intent signal. A transaction can fail, disappear or occur in
a skipped slot. It has no execution status, logs, inner instructions or balances.
Confirm outcomes over RPC / commitment-aware channels.
`tx_pb_base64` contains a protobuf `solana.storage.ConfirmedBlock.Transaction`,
**not Solana wire bytes**. Do not pass it to `sendTransaction` or a wire decoder.

## TypeScript

Install `ws` (`@types/ws` for checking). Set `SOL_STREAM=firehose` to select the
firehose; the default is filtered pre-execution. For pre-execution set
`SOL_ACCOUNT` to an account relevant to the task. This bounded example closes
after one transaction or the client deadline; it does not send a subscribe frame.

```ts
import WebSocket from "ws";
const key = process.env.TRIPORT_API_KEY;
if (!key) throw new Error("Set TRIPORT_API_KEY");
const firehose = process.env.SOL_STREAM === "firehose";
const account = process.env.SOL_ACCOUNT;
if (!firehose && !account) throw new Error("Set SOL_ACCOUNT for pre-execution");
const url = new URL(firehose ? "wss://triport.io/ws/sol-stream" : "wss://triport.io/ws/sol-preexec");
if (!firehose) url.searchParams.set("accounts", account!);
const ws = new WebSocket(url, { headers: { "x-token": key } });
const timer = setTimeout(() => ws.close(), 20000);
ws.on("message", raw => {
  const frame = JSON.parse(raw.toString());
  if (frame.error) { console.error("stream refused", frame.error); ws.close(); return; }
  if (firehose && frame.t === "tx") {
    console.log({ signature: frame.s, slot: frame.l, feeLamports: frame.f });
    ws.close();
  } else if (!firehose && frame.pre_exec === true) {
    console.log({ signature: frame.signature, slot: frame.slot, accounts: frame.account_keys });
    const protobufBytes = Buffer.from(frame.tx_pb_base64, "base64");
    console.log("protobuf bytes", protobufBytes.length); // Not a sendable wire transaction.
    ws.close();
  }
});
ws.on("error", () => { console.error("WebSocket connection failed"); ws.close(); });
ws.on("close", code => { clearTimeout(timer); console.log("close code", code); });
```

## Python

Install `websockets>=14`. The same environment variables select the stream.

```python
import asyncio
import base64
import json
import os
from urllib.parse import urlencode
from websockets.asyncio.client import connect

async def main():
    firehose = os.getenv("SOL_STREAM") == "firehose"
    url = "wss://triport.io/ws/sol-stream" if firehose else "wss://triport.io/ws/sol-preexec"
    if not firehose:
        url += "?" + urlencode({"accounts": os.environ["SOL_ACCOUNT"]})
    async with asyncio.timeout(20):
        async with connect(url, additional_headers={"x-token": os.environ["TRIPORT_API_KEY"]}) as ws:
            async for raw in ws:
                frame = json.loads(raw)
                if frame.get("error"):
                    raise RuntimeError(f"Stream refused: {frame['error']}")
                if firehose and frame.get("t") == "tx":
                    print(frame["s"], frame["l"], frame.get("f"))
                    break
                if not firehose and frame.get("pre_exec") is True:
                    print(frame["signature"], frame["slot"], frame["account_keys"])
                    protobuf_bytes = base64.b64decode(frame["tx_pb_base64"], validate=True)
                    print("protobuf bytes", len(protobuf_bytes))
                    break

if __name__ == "__main__":
    asyncio.run(main())
```

## Common errors

- **401 / close 4001:** missing/invalid key; verify credentials and expiry before retrying.
- **429 / close 4029:** concurrent stream limit. Close old sockets cleanly; use
  bounded exponential backoff with jitter. Never run an immediate reconnect loop.
- **-32601:** neither endpoint accepts JSON-RPC subscription methods. Firehose
  ignores client messages; configure pre-execution with URL filters and reconnect
  to change them. Use `/ws/sol` for `logsSubscribe`, or gRPC for server-side filters.
- **4003:** inspect `tier_insufficient`, `filter_required` or `filter_too_wide`;
  change the plan/filter, not retry timing. Firehose expiry can close with `4030`.

## Documentation

[Shreds / pre-execution](https://triport.io/docs/streaming/sol-preexec),
[firehose](https://triport.io/docs/streaming/sol-stream),
[filter tutorial](https://triport.io/docs/guides/filter-solana-pre-execution-by-account),
[streaming](https://triport.io/docs/streaming),
[limits](https://triport.io/docs/rate-limits-and-tiers).
