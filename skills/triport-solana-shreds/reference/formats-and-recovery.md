# Formats and recovery

## Pre-execution

The [pre-execution guide](https://triport.io/docs/streaming/sol-preexec)
documents Pro: 2 concurrent streams per key, required filter up to 50 accounts;
Business: 4 streams, optional filter up to 200 accounts. These are plan limits,
not throughput guarantees. Recheck the public page before sizing deployment.

Query `accounts` is a comma-separated list. Matching includes ALT-resolved
addresses. `fmt=json` is default; `fmt=raw` binds the consumer to protobuf schema.
Filters are fixed for the connection lifetime. There is no `SubscribeDeshred`
gRPC equivalent on Triport.

JSON fields: `signature`, `slot`, `is_vote`, `tx_pb_base64`, `account_keys`,
`pre_exec: true`, `ts`. The account ordering is static message keys, ALT writable,
ALT readonly. `ts` is the Triport frame construction timestamp, not leader time;
do not use clock differences as a latency claim.

Close `4029` can mean a new socket was refused (`stream_limit`) or the oldest
socket was superseded. A disconnected process may keep its stream slot until
the server detects the dead connection. Close cleanly and back off before retrying.

## Firehose

The [firehose guide](https://triport.io/docs/streaming/sol-stream) documents a
fixed push-only feed. No subscribe request or client filter is applied. A
transaction frame uses `t: tx`, `l` (slot), `s` (signature), optional `f` (fee
in lamports), optional `e` (failed). `t: stats` is not a transaction. A compact
transaction frame has no instructions, accounts, logs or balances; retrieve
details using `getTransaction` on `https://triport.io/sol`.

## Reconnect and reconcile

Both streams are live, at-most-once, with no replay/backfill cursor. Slow readers
can lose frames. Read continuously and hand work off to a bounded queue; record
loss instead of silently claiming completeness. Deduplicate by signature and
keep pre-execution observations separate from execution results.

After a transient disconnect, retry with exponential backoff and jitter, cap
attempts or elapsed time, and stop on credential/tier/filter rejection. Standard
WS libraries answer protocol pings automatically. For account history gaps use
`getSignaturesForAddress`; for slot ranges use `getBlock` at the intended commitment.
RPC history can confirm outcomes; it cannot reconstruct discarded pre-execution intent.
