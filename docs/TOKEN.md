# NYCARGO — token and its use in the game

| | |
|---|---|
| Name / ticker | Not Your Cargo / NYCARGO |
| Network | Solana mainnet |
| Mint | `5RWFPAucUS9h4bx1ApTftAWc87jVMxzPTkZwVHSeidos` |
| Standard | SPL token, 6 decimals, supply 1 000 000 000, mint and freeze authorities null (checked on-chain 2026-10-07) |
| Issued | by the owner through the iDos launch flow on 2026-10-06; not re-issued |

The game never requires the token. It is not a stake, prize or reward: no player receives anything from another player's wallet, and nothing in combat changes with it.

## 1. Steppe Trail (holders, ≥ 1 NYCARGO)

1. The player links a Solana wallet to their iDos account by signing a message (inside idosgames.com the site's wallet signs).
2. CloudCode handler `nycTrailBalance` (`game/cloudcode/nyc-trail.js`) reads the **signature-verified** linked wallet from the player's server record — never from client arguments — and asks Solana RPC for the balance of the exact mint.
3. If the server can't reach RPC (CloudCode outbound HTTP is a paid-plan feature), the client reads the same verified wallet and queries RPC from the browser (URL from Title Data `solanaRpcUrl`).
4. States: disconnected / loading / eligible / insufficient / error. An RPC error is never treated as zero. A newer check cancels an older one (wallet switch).

Effect: an engine trail and a gold ring on the bike, visible to the opponent in PvP.

## 2. Cargo crates (in-game NYCARGO balance)

- Players deposit NYCARGO to their in-game balance through the iDos site wallet (crypto currency `Main` in the title config).
- Lootbox `cargo_crate`: 50 NYCARGO, rolled by the iDos server: Common 60 % / Rare 28 % / Epic 10 % / Legendary 2 %; every 10th crate adds one Epic or Legendary (pity). Drops are bike paints (item catalog `Skin`), cosmetic only.
- Ownership = the server inventory. Paints show in campaign and PvP; the side colour stays visible as a ring.

## 3. Achievement NFT souvenirs

- For an achievement the account has, the player can mint a Metaplex Core asset ("NYC · <achievement>", image + metadata at `https://qa0x2dy9.idos.games/nft/<id>.json`).
- The **player's** wallet is payer, owner and update authority; the game holds no keys and pays nothing (≈0.002 SOL rent + fee for the player).
- No verified collection and client-side achievements → it is a souvenir, not a proof of skill.

## What is not verified yet

A real deposit and crate purchase, a real NFT mint on mainnet, a wallet without the token. See [VALIDATION.md](VALIDATION.md#4-token-flows-q13).
