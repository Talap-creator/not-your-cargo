// Achievement souvenirs as NFTs (Metaplex Core assets on Solana), minted BY THE PLAYER from their
// own wallet: the player is the payer and the owner; the game never holds a key and pays nothing.
// Honest limits: achievements are tracked client-side, and an asset without a verified collection
// can be minted by anyone — this is a souvenir, not a proof. The game offers the mint only for an
// achievement the account has (progress syncs via the cloud save). One mint per achievement per browser.
import { Buffer } from "buffer";
import { Keypair, PublicKey, SystemProgram, Transaction, TransactionInstruction, type Connection } from "@solana/web3.js";

export const MPL_CORE = new PublicKey("CoREENxT6tW1HoK8ypY1SxRMZTcVPm7R94rH4PZNhX7d");
/** Metadata JSON + image live in the live build (public/nft/<id>.json). */
export const NFT_BASE = "https://qa0x2dy9.idos.games/nft/";
const MINTED_KEY = "nyc.nft.minted.v1";

const enc = new TextEncoder();
function str(s: string): Uint8Array {
  const b = enc.encode(s);
  const out = new Uint8Array(4 + b.length);
  new DataView(out.buffer).setUint32(0, b.length, true);
  out.set(b, 4);
  return out;
}

/**
 * mpl-core CreateV1: discriminator 0, DataState::AccountState (0), name, uri, plugins: None.
 * Accounts (fixed order; an absent optional account is the program id): asset (signer, new),
 * collection, authority, payer (signer), owner, update authority, system program, log wrapper.
 */
export function createAssetIx(asset: PublicKey, payer: PublicKey, name: string, uri: string): TransactionInstruction {
  const data = new Uint8Array([0, 0, ...str(name), ...str(uri), 0]);
  const none = { pubkey: MPL_CORE, isSigner: false, isWritable: false };
  return new TransactionInstruction({
    programId: MPL_CORE,
    keys: [
      { pubkey: asset, isSigner: true, isWritable: true },
      none, // collection
      none, // authority (defaults to payer)
      { pubkey: payer, isSigner: true, isWritable: true },
      none, // owner (defaults to payer)
      none, // update authority (defaults to payer)
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      none, // log wrapper
    ],
    data: Buffer.from(data),
  });
}

export const nftName = (achievementName: string) => `NYC · ${achievementName}`.slice(0, 32);
export const nftUri = (achievementId: string) => `${NFT_BASE}${encodeURIComponent(achievementId)}.json`;

export function mintedSet(): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(MINTED_KEY) ?? "[]") as string[]);
  } catch {
    return new Set();
  }
}
function remember(id: string): void {
  try {
    localStorage.setItem(MINTED_KEY, JSON.stringify([...mintedSet(), id]));
  } catch {
    /* storage blocked: the button just stays */
  }
}

interface PhantomLike {
  publicKey?: { toString(): string } | null;
  connect(): Promise<{ publicKey: { toString(): string } }>;
  signTransaction(tx: Transaction): Promise<Transaction>;
}
export function browserWallet(): PhantomLike | null {
  const w = globalThis as { phantom?: { solana?: PhantomLike }; solana?: PhantomLike };
  return w.phantom?.solana ?? w.solana ?? null;
}

/** Build, let the player's wallet sign as payer, send. Returns the asset address. */
export async function mintAchievement(conn: Connection, wallet: PhantomLike, achievementId: string, name: string): Promise<{ asset: string; signature: string }> {
  const { publicKey } = await wallet.connect();
  const payer = new PublicKey(publicKey.toString());
  const asset = Keypair.generate();
  const tx = new Transaction().add(createAssetIx(asset.publicKey, payer, nftName(name), nftUri(achievementId)));
  tx.feePayer = payer;
  const { blockhash, lastValidBlockHeight } = await conn.getLatestBlockhash("confirmed");
  tx.recentBlockhash = blockhash;
  tx.partialSign(asset);
  const signed = await wallet.signTransaction(tx);
  const signature = await conn.sendRawTransaction(signed.serialize());
  await conn.confirmTransaction({ signature, blockhash, lastValidBlockHeight }, "confirmed");
  remember(achievementId);
  return { asset: asset.publicKey.toBase58(), signature };
}
