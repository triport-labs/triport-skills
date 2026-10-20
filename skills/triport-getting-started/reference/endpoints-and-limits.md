# Endpoints and limits

Use headers for backend requests. The public per-network guides publish these
routes; use a dashboard-generated enabled template when a key-in-URL client is needed.

| Network id | HTTPS path on `https://triport.io` | WSS path on `wss://triport.io` |
|---|---|---|
| `sol` | `/sol` | `/ws/sol` |
| `eth` | `/eth` | `/ws/eth` |
| `base` | `/rpc/base` | `/ws/base` |
| `bsc` | `/rpc/bsc` | No mounted stream published |
| `polygon` | `/polygon` | `/ws/poly` (not `/ws/polygon`) |
| `robinhood` | `/rpc/robinhood` | `/ws/robinhood` |
| `tron` | `/rpc/tron` | No general WS route published |
| `ton` | `/rpc/ton` | No general WS route published |
| `stellar` | `/rpc/stellar` | Use Horizon SSE, not general WS |

The discovery templates are `https://triport.io/r/{key}/<chain>` and
`wss://triport.io/ws/r/{key}/<chain>`; copy the enabled `url_template` verbatim
and substitute locally. The Base guide explicitly shows
`https://triport.io/r/{key}/rpc/base`. Do not guess aliases for streams or REST.
Never persist or log URLs after substitution.

Scope ids include `solana:rpc`, `eth:rpc`, `base:rpc`, `bsc:rpc`,
`polygon:rpc`, `robinhood:rpc`, `tron:rpc`, `ton:rpc`, `stellar:rpc`.
`base:ws` is separate; Yellowstone requires `stream.grpc.solana`.

## Sourced plan limits

The following values are copied from the public
[rate-limits-and-tiers reference](https://triport.io/docs/rate-limits-and-tiers)
(documentation snapshot reviewed 2026-10-20). Consult that source again before
quoting limits to a user; individual categories and contracts can differ.

| Category | Free | Basic | Pro | Business | Enterprise |
|---|---:|---:|---:|---:|---|
| `sol_read_rpc` sustained RPS | 20 | 60 | 200 | 600 | unlimited unless overridden |
| `sol_read_rpc_heavy` sustained RPS | 2 | 5 | 20 | 80 | unlimited unless overridden |
| `sol_send_tx` sustained RPS | 5 | 10 | 50 | 150 | unlimited unless overridden |
| `eth_read_rpc` sustained RPS | 10 | 20 | 100 | 250 | unlimited unless overridden |
| `eth_send_tx` sustained RPS | 3 | 5 | 30 | 80 | unlimited unless overridden |
| `wallet_identity` sustained RPS | unavailable | unavailable | unavailable | 30 | 150 |

Finite RPS budgets have a burst buffer of twice sustained RPS. There is no daily
request cap or quota on burst count. Each batch element is metered separately.
Burst capacity does not increase stream/filter/concurrent-connection limits.
Free is a seven-day trial. Stream products have separate tier and concurrency gates.

`X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Category` and
`X-RateLimit-Reset` describe metering; HTTP 429 has `Retry-After` in seconds.
Successful Base responses are documented as lacking these rate-limit headers.
Base budgets are provisional and Enterprise Base limits are finite contract
values. Do not copy the generic unlimited Enterprise claim onto Base.

BSC, Tron, TON, Stellar and Robinhood default category budgets are marked
unmeasured in the source. They are product policy, not capacity or SLA claims.
Avoid inferring a network's budget from another network's numbers.

Sources: [Base](https://triport.io/docs/base),
[Polygon WS](https://triport.io/docs/streaming/poly-ws),
[BSC](https://triport.io/docs/bsc), [Tron](https://triport.io/docs/tron),
[TON](https://triport.io/docs/ton), [Stellar](https://triport.io/docs/stellar),
[Robinhood](https://triport.io/docs/robinhood),
[endpoint discovery](https://triport.io/docs/platform/get-key-endpoints).
