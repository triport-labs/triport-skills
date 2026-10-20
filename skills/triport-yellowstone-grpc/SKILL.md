---
name: triport-yellowstone-grpc
description: Connect a backend to Triport Solana Yellowstone Geyser gRPC, authenticate with x-token metadata, choose slot/account/transaction filters, handle ping messages, or restore subscriptions with reconnect backoff. Use for native protobuf gRPC streams, not Solana WebSocket firehose or shred feeds.
---

# Triport Yellowstone gRPC

Use for filtered backend streams of slots, accounts, transactions and blocks.
Dial `grpc.triport.io:443` over TLS (`https://grpc.triport.io` for URL-based
clients). Send `x-token: $TRIPORT_API_KEY` as gRPC metadata on **each** call.
The key needs `stream.grpc.solana` and Pro or above. This is a native HTTP/2
protobuf service, not JSON-RPC, WebSocket or the pre-execution feed.

Service: `geyser.Geyser/Subscribe` (bidirectional stream).
`geyser.Geyser/GetVersion` is the unary connectivity check. Reflection may not
expose the Geyser descriptors; supply the actual schema instead of assuming
`grpcurl list` proves service absence.

Read [schema setup and filters](reference/schema-and-filters.md) for dependencies,
proto generation and account/transaction examples. The snippets below use the
standard Yellowstone `geyser.proto` and imported `solana-storage.proto` from
the **same pinned schema revision**. Set `GEYSER_PROTO_DIR` for TypeScript;
Python needs the generated modules on `PYTHONPATH`.

## TypeScript

Install `@grpc/grpc-js` and `@grpc/proto-loader`. This sample subscribes to slots,
answers application pings and retries transient disconnections with capped
exponential backoff and jitter. Five attempts and the delay cap are client policy.
Authentication and unsupported-service errors stop immediately. Interrupt to stop.

```ts
import * as grpc from "@grpc/grpc-js";
import { loadSync } from "@grpc/proto-loader";
import path from "node:path";

const key = process.env.TRIPORT_API_KEY;
const protoDir = process.env.GEYSER_PROTO_DIR;
if (!key || !protoDir) throw new Error("Set TRIPORT_API_KEY and GEYSER_PROTO_DIR");
const definitions = loadSync(path.join(protoDir, "geyser.proto"), {
  includeDirs: [protoDir], keepCase: false, longs: String, enums: String,
});
const service = definitions["geyser.Geyser"] as grpc.ServiceDefinition;
const subscribe = Object.values(service).find(method => method.path.endsWith("/Subscribe"));
if (!subscribe) throw new Error("Geyser Subscribe descriptor missing");
const request = { slots: { watched: { filterByCommitment: true } }, commitment: "CONFIRMED" };
const retryable = new Set([grpc.status.UNAVAILABLE, grpc.status.RESOURCE_EXHAUSTED, grpc.status.DEADLINE_EXCEEDED]);
for (let attempt = 0; attempt < 5; attempt++) {
  const client = new grpc.Client("grpc.triport.io:443", grpc.credentials.createSsl());
  const metadata = new grpc.Metadata();
  metadata.set("x-token", key);
  const code = await new Promise<number>(resolve => {
    const stream = client.makeBidiStreamRequest(subscribe.path,
      subscribe.requestSerialize, subscribe.responseDeserialize, metadata);
    stream.write(request);
    stream.on("data", (update: Record<string, unknown>) => {
      if (update.ping) stream.write({ ping: { id: 1 } });
      if (update.slot) console.log(update.slot);
    });
    stream.on("error", (error: grpc.ServiceError) => resolve(error.code));
    stream.on("end", () => resolve(grpc.status.UNAVAILABLE));
  });
  client.close();
  if (!retryable.has(code) || attempt === 4) throw new Error(`gRPC status ${code}`);
  const delay = Math.min(30000, 1000 * 2 ** attempt) + Math.random() * 500;
  await new Promise(resolve => setTimeout(resolve, delay));
}
```

## Python

Install `grpcio`; generated `geyser_pb2` and `geyser_pb2_grpc` are prerequisites.
The queue keeps the request direction open and sends ping replies. Reconnects
resend the filter; they cannot replay the interval lost during disconnection.

```python
import os
import queue
import random
import time
import grpc
from geyser_pb2 import (SubscribeRequest, SubscribeRequestFilterSlots,
                        SubscribeRequestPing, CommitmentLevel)
from geyser_pb2_grpc import GeyserStub

key = os.environ["TRIPORT_API_KEY"]
retryable = {grpc.StatusCode.UNAVAILABLE, grpc.StatusCode.RESOURCE_EXHAUSTED,
             grpc.StatusCode.DEADLINE_EXCEEDED}
for attempt in range(5):
    outbound = queue.Queue()
    outbound.put(SubscribeRequest(slots={"watched": SubscribeRequestFilterSlots(filter_by_commitment=True)},
                                  commitment=CommitmentLevel.CONFIRMED))
    def requests(outbound=outbound):
        while True:
            request = outbound.get()
            if request is None:
                return
            yield request
    try:
        with grpc.secure_channel("grpc.triport.io:443", grpc.ssl_channel_credentials()) as channel:
            for update in GeyserStub(channel).Subscribe(requests(), metadata=(("x-token", key),)):
                if update.HasField("ping"):
                    outbound.put(SubscribeRequest(ping=SubscribeRequestPing(id=1)))
                if update.HasField("slot"):
                    print(update.slot)
    except grpc.RpcError as error:
        if error.code() not in retryable or attempt == 4:
            raise RuntimeError(f"gRPC status {error.code().name}") from None
    finally:
        outbound.put(None)
    if attempt == 4:
        raise RuntimeError("gRPC retry budget exhausted")
    time.sleep(min(30, 2 ** attempt) + random.random() / 2)
```

## Recovery and common errors

- **401 / UNAUTHENTICATED:** verify `x-token` metadata, expiration and revocation.
  **PERMISSION_DENIED** needs `stream.grpc.solana` and a qualifying tier.
- **429 / RESOURCE_EXHAUSTED:** native gRPC usually uses status codes, not HTTP
  429. Close stale streams, respect concurrent capacity, back off and bound retries.
- **-32601 / UNIMPLEMENTED:** `-32601` is JSON-RPC, not a native Geyser status.
  Use `geyser.Geyser/Subscribe` on the gRPC host; verify schema/service compatibility
  on UNIMPLEMENTED. Do not send JSON-RPC methods over this connection.
- An HTML 403 or invalid gRPC compression flag means the response was not gRPC;
  check the hostname and TLS/proxy path before changing protobuf definitions.
- Live streams have **no replay buffer**. Narrow filters, keep a fast reader,
  persist processed positions and reconcile gaps using Solana RPC history. Never
  mark an unreconciled gap as complete. Slot updates alone are not transaction finality.

## Documentation

[Triport Yellowstone](https://triport.io/docs/streaming/sol-grpc),
[streaming overview](https://triport.io/docs/streaming),
[limits](https://triport.io/docs/rate-limits-and-tiers).
