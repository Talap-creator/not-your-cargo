# Steppe Trail (NYCARGO cosmetic)

- Eligibility is decided server-side by the CloudCode handler `nycTrailBalance` (cloudcode/nyc-trail.js): public Solana RPCs return 403 to browser origins, so the client cannot read balances itself.
- Wallet = the signature-verified LinkedWallets.solana only; never an address from args or localStorage.
- RPC failure is the "error" state, never zero. Purely visual: no stat, hitbox or visibility change; peers see it through the loadout message.
