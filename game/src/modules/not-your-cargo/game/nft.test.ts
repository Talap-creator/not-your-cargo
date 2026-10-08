import { describe, expect, it } from "vitest";
import { Keypair, SystemProgram } from "@solana/web3.js";
import { createAssetIx, MPL_CORE, nftName, nftUri } from "./nft";

describe("achievement NFT (mpl-core CreateV1)", () => {
  it("encodes discriminator, AccountState, name, uri and no plugins; the player pays and signs", () => {
    const asset = Keypair.generate().publicKey;
    const payer = Keypair.generate().publicKey;
    const ix = createAssetIx(asset, payer, nftName("C01 · Hard"), nftUri("C01.hard"));
    expect(ix.programId.equals(MPL_CORE)).toBe(true);
    const d = new Uint8Array(ix.data);
    expect([d[0], d[1]]).toEqual([0, 0]);
    const dv = new DataView(d.buffer, d.byteOffset);
    const nameLen = dv.getUint32(2, true);
    expect(new TextDecoder().decode(d.slice(6, 6 + nameLen))).toBe("NYC · C01 · Hard");
    const uriAt = 6 + nameLen;
    const uriLen = dv.getUint32(uriAt, true);
    expect(new TextDecoder().decode(d.slice(uriAt + 4, uriAt + 4 + uriLen))).toBe("https://qa0x2dy9.idos.games/nft/C01.hard.json");
    expect(d[uriAt + 4 + uriLen]).toBe(0); // plugins: None
    expect(d.length).toBe(uriAt + 5 + uriLen);
    expect(ix.keys[0]).toMatchObject({ isSigner: true, isWritable: true });
    expect(ix.keys[0]!.pubkey.equals(asset)).toBe(true);
    expect(ix.keys[3]!.pubkey.equals(payer)).toBe(true);
    expect(ix.keys[3]).toMatchObject({ isSigner: true, isWritable: true });
    expect(ix.keys[6]!.pubkey.equals(SystemProgram.programId)).toBe(true);
    // absent optional accounts are the program id, never a signer
    for (const i of [1, 2, 4, 5, 7]) expect(ix.keys[i]!.pubkey.equals(MPL_CORE) && !ix.keys[i]!.isSigner).toBe(true);
  });

  it("names fit 32 chars", () => {
    expect(nftName("A very long achievement name that goes on").length).toBeLessThanOrEqual(32);
  });
});
