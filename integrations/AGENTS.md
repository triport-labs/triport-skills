## Triport API tasks

For Triport work, read only the relevant local entrypoint, then follow its linked
references as needed. The project keeps this repository at `.triport-skills/`:

- Key setup, endpoint templates, tiers and pacing: `.triport-skills/skills/triport-getting-started/SKILL.md`.
- Solana RPC, Pub/Sub, address history, fees or signed sends: `.triport-skills/skills/triport-solana-rpc/SKILL.md`.
- Yellowstone native gRPC filters or reconnects: `.triport-skills/skills/triport-yellowstone-grpc/SKILL.md`.
- Solana shreds, pre-execution or firehose: `.triport-skills/skills/triport-solana-shreds/SKILL.md`.
- Ethereum, Base, BNB Chain, Polygon or Robinhood RPC/logs/WS: `.triport-skills/skills/triport-evm-rpc/SKILL.md`.
- Wallet identity, activity and watch: `.triport-skills/skills/triport-wallet-apis/SKILL.md`.
- Tron, TON or Stellar: `.triport-skills/skills/triport-other-chains/SKILL.md`.

Use these skills only for matching Triport tasks. Keep keys in the environment;
do not log secrets or substituted URLs. Preserve the user's intended networks,
request budget and authorization for transaction broadcasts or account changes.
