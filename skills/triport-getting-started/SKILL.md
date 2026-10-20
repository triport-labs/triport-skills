---
name: triport-getting-started
description: Configure a Triport API key, choose network endpoint URLs, make a first RPC request, or diagnose authentication and per-tier rate limits. Use for Triport setup, endpoint discovery, 401 errors and 429 pacing across the nine supported networks.
---

# Triport getting started

Use for a first integration, key setup, chain selection or rate-limit troubleshooting.
Create a key in the Triport dashboard, enable the required chain scopes, and set
`TRIPORT_API_KEY` in the process environment. Never print the key or resolved keyed URLs.

Read [endpoints and limits](reference/endpoints-and-limits.md) before choosing a
route or sizing concurrency. Prefer the `x-token` header. HTTPS templates use
`https://triport.io/r/{key}/<chain>` and WSS templates use
`wss://triport.io/ws/r/{key}/<chain>` where supplied by endpoint discovery;
do not derive every product route from these templates. Base, Polygon WS and
product streams have route-specific rules in the reference.

`GET https://triport.io/v1/keys/{id}/endpoints` requires the owning dashboard
session cookie, **not the API key**. Only connect to rows with `status: enabled`;
`scope_missing` needs key configuration and `revoked` needs local secret eviction.
gRPC uses TLS to `grpc.triport.io:443` with `x-token` metadata.

## First request

These read-only examples require Node.js 22+ or Python 3.12+. Save either fence
as a file; TypeScript can run with `node --experimental-strip-types example.ts`.
They stop on authentication, transport and RPC failures and retry HTTP 429 a
bounded number of times. The retry count is an example client policy, not a plan limit.

```ts
const key = process.env.TRIPORT_API_KEY;
if (!key) throw new Error("Set TRIPORT_API_KEY");
for (let attempt = 0; attempt < 4; attempt++) {
  const response = await fetch("https://triport.io/sol", {
    method: "POST", headers: { "x-token": key, "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "getSlot", params: [] }),
    signal: AbortSignal.timeout(15000),
  });
  if (response.status === 429 && attempt < 3) {
    const hint = Number(response.headers.get("Retry-After") ?? 1);
    const seconds = Number.isFinite(hint) && hint > 0 ? hint : 1;
    await new Promise(resolve => setTimeout(resolve, seconds * 1000 + Math.random() * 250));
    continue;
  }
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const body = await response.json();
  if (body.error) throw new Error(`RPC ${body.error.code}`);
  console.log("slot", body.result);
  break;
}
export {};
```

```python
import json
import os
import random
import time
from urllib.error import HTTPError
from urllib.request import Request, urlopen

key = os.environ["TRIPORT_API_KEY"]
payload = json.dumps({"jsonrpc": "2.0", "id": 1, "method": "getSlot", "params": []}).encode()
for attempt in range(4):
    request = Request("https://triport.io/sol", data=payload,
                      headers={"x-token": key, "Content-Type": "application/json"})
    try:
        with urlopen(request, timeout=15) as response:
            body = json.load(response)
    except HTTPError as error:
        if error.code != 429 or attempt == 3:
            raise RuntimeError(f"HTTP {error.code}") from None
        try:
            delay = max(1.0, float(error.headers.get("Retry-After", "1")))
        except ValueError:
            delay = 1.0
        error.close()
        time.sleep(delay + random.random() / 4)
        continue
    if body.get("error"):
        raise RuntimeError(f"RPC {body['error']['code']}")
    print("slot", body["result"])
    break
```

## Common errors

- **401:** check the environment variable, expiration and revocation. An expired
  Free trial can return `trial_expired`; repeated retries cannot fix it.
- **429:** honor `Retry-After`, add jitter, bound retries and lower sustained
  concurrency for the charged category. A JSON-RPC batch spends one token per element.
- **-32601:** check the method against the selected chain's catalog and transport;
  HTTP `403 method_unknown` can also reject a method before RPC dispatch.
- **403:** distinguish `tier_insufficient` from missing chain scope. Read the
  error envelope and required tier rather than treating this as a transient error.

## Documentation

[Getting started](https://triport.io/docs/getting-started),
[authentication](https://triport.io/docs/authentication),
[endpoint discovery](https://triport.io/docs/platform/get-key-endpoints),
[rate limits and tiers](https://triport.io/docs/rate-limits-and-tiers),
[errors](https://triport.io/docs/errors).
