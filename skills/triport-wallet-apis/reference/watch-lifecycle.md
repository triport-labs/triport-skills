# Watch lifecycle and delivery

Creating, patching or deleting a subscription changes the user's account.
Perform it when that is the user's intended operation; the functions below do
not execute until called. Use `GET /v1/wallet/watch` to inspect existing watches
before creating duplicates. Store returned `id`; `DELETE /v1/wallet/watch/{id}`
removes a watch when it is no longer wanted.

## Create a pull subscription

The non-empty watchlist is required for `wallet_activity`. `delivery.type` can
be `pull`, `ws` or `webhook`. Read the actual returned subscription instead of
assuming requested options were enabled.

```ts
export async function createWatch(address: string): Promise<{ id: string }> {
  if (!/^0x[\da-fA-F]{40}$/.test(address)) throw new Error("Invalid EVM address");
  const key = process.env.TRIPORT_API_KEY;
  if (!key) throw new Error("Set TRIPORT_API_KEY");
  const response = await fetch("https://triport.io/v1/wallet/watch", {
    method: "POST", headers: { "x-token": key, "Content-Type": "application/json" },
    body: JSON.stringify({ name: "wallet-activity", chains: ["eth", "base"],
      events: ["wallet_activity"], watchlist: [address], delivery: { type: "pull" } }),
    signal: AbortSignal.timeout(30000),
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}
```

```python
import json
import os
import re
from urllib.error import HTTPError
from urllib.request import Request, urlopen

def create_watch(address):
    if not re.fullmatch(r"0x[\da-fA-F]{40}", address):
        raise ValueError("Invalid EVM address")
    body = {"name": "wallet-activity", "chains": ["eth", "base"],
            "events": ["wallet_activity"], "watchlist": [address], "delivery": {"type": "pull"}}
    request = Request("https://triport.io/v1/wallet/watch", data=json.dumps(body).encode(),
        headers={"x-token": os.environ["TRIPORT_API_KEY"], "Content-Type": "application/json"})
    try:
        with urlopen(request, timeout=30) as response:
            return json.load(response)
    except HTTPError as error:
        raise RuntimeError(f"HTTP {error.code}") from None
```

Do not blindly retry creation after a timeout: the first POST may have succeeded.
List the account's watches and reconcile before issuing another POST.

## Durable consumer

For REST, request `GET /v1/wallet/watch/{id}/events?cursor=<saved>&limit=100`.
For WS, connect to `wss://triport.io/ws/wallet-watch?id=<id>&cursor=<saved>`
using the `x-token` upgrade header. Handle `resume` control frames separately
from activity. Persist opaque cursors rather than deprecated `after_seq` / `seq`.

For each event, atomically commit its effect, its `event_id` and its cursor in
the consuming application's store. Dedupe redeliveries by `event_id`; a process
local Set is insufficient across crashes. Advance page `next_cursor` only after
all events are durable, then follow `has_more`. Maintain order per network;
cross-network ordering is not guaranteed.

- `wallet_activity`: apply movements for the watched address. Two watched
  addresses in one transaction produce separate events; tx hash is not a unique event id.
- `reorg_revert`: undo the affected events using `removed_event_ids`.
- `gap`: mark the reported block range unverified; `recoverable:false` must not
  be hidden by advancing a cursor.
- HTTP `410 cursor_expired` / WS `cursor_expired` and close `4410`: report the
  lost interval and read `oldest_cursor`. Selecting it resumes retained data;
  it does not recover expired events. Stop automatic retries until gap handling
  has accepted that loss or an independent backfill has reconciled it.

Webhook delivery is at least once. Verify `X-Triport-Signature` as
`sha256=<hex HMAC-SHA256(raw body, configured secret)>` with a constant-time
comparison **before** parsing/applying events. Dedupe `X-Triport-Event-Id`, persist
`X-Triport-Cursor` with the effect, and acknowledge only after durable processing.
Do not reserialize the parsed JSON for signature verification.

Use `/v1/wallet/watch/coverage` before relying on internal native movements.
Optional confirmations and enrichment depend on published coverage/capabilities;
a requested option may return `503 option_unavailable` rather than silently work.

[Watch](https://triport.io/docs/platform/wallet-watch),
[activity and resume](https://triport.io/docs/platform/wallet-activity),
[identity partial results](https://triport.io/docs/platform/wallet-identity).
