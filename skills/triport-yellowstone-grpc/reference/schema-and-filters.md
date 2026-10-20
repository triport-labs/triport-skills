# Schema setup and filters

Use the standard Yellowstone
[proto directory](https://github.com/rpcpool/yellowstone-grpc/tree/master/yellowstone-grpc-proto/proto).
Pin a commit in the consuming project and take `geyser.proto` and
`solana-storage.proto` from that same revision; do not mix generated message and
service versions. No schema download or live service access is needed by this
repository's syntax checks.

TypeScript loads those files at runtime through `GEYSER_PROTO_DIR`. Set it to
the directory containing both files. The loader uses camelCase field names;
the Python generated classes use snake_case. Install the npm dependencies in
the consuming project so module resolution works from the example's location.

Python: install `grpcio`, `grpcio-tools` and `protobuf` in a virtual environment,
then run from the proto directory:

```sh
python -m grpc_tools.protoc -I . --python_out=. --grpc_python_out=. geyser.proto solana-storage.proto
```

Put that directory on `PYTHONPATH`. The generated stubs and protobuf runtime
must be compatible. The `py_compile` check verifies syntax without importing
these generated runtime modules.

## Filter recipes

The slot filter in SKILL.md is a useful first diagnostic because updates are
frequent. Replace its request with the following shapes when the user needs
program accounts or relevant transactions (JSON shows the TypeScript loader shape):

```json
{
  "accounts": {
    "tokenAccounts": { "owner": ["TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"] }
  },
  "transactions": {
    "touchingTokenProgram": {
      "vote": false,
      "failed": false,
      "accountInclude": ["TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"]
    }
  },
  "commitment": "CONFIRMED"
}
```

Python equivalents use `SubscribeRequestFilterAccounts(owner=[...])` and
`SubscribeRequestFilterTransactions(vote=False, failed=False, account_include=[...])`.
`accountInclude` matches any listed account; `accountRequired` requires all;
`accountExclude` excludes matches. Keep account/program filters as narrow as the
task allows. On reconnect send the **complete** request again, not only its ping.
Ping-only messages respond to server pings without intentionally replacing filters.

[Triport filter examples](https://triport.io/docs/streaming/sol-grpc),
[canonical protobuf](https://github.com/rpcpool/yellowstone-grpc/blob/master/yellowstone-grpc-proto/proto/geyser.proto).
