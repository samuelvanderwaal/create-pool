import {
  Connection,
  Keypair,
  PublicKey,
  TransactionMessage,
  VersionedTransaction,
} from "@solana/web3.js";
import { address } from "@solana/web3.js-next";
import "@solana/webcrypto-ed25519-polyfill";
import { CurveType, PoolType } from "@tensor-foundation/amm";
import { findWhitelistV2Pda, Mode } from "@tensor-foundation/whitelist";
import { readFileSync } from "fs";
import { v4 } from "uuid";
import {
  createWhitelistV2,
  getCreatePoolIx,
  uuidToUint8Array,
} from "./helpers";

const RPC_URL = process.env.RPC_URL;

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

async function main() {
  const connection = new Connection(RPC_URL!);

  // Load json file bytes
  const signerJson = JSON.parse(readFileSync("signer.json", "utf8"));
  const bytes = new Uint8Array(signerJson);

  // Create signer.
  const signer = Keypair.fromSecretKey(bytes);

  const namespace = Keypair.generate();
  const uuid = v4();
  const poolId = uuidToUint8Array(uuid);

  const conditions = [
    { mode: Mode.FVC, value: address(signer.publicKey.toString()) },
  ];

  const [whitelist] = await findWhitelistV2Pda({
    namespace: address(namespace.publicKey.toString()),
    uuid: uuidToUint8Array(uuid),
  });

  const createWhitelistIx = await createWhitelistV2({
    payer: signer.publicKey,
    updateAuthority: signer.publicKey,
    namespace: namespace.publicKey,
    uuid,
    freezeAuthority: signer.publicKey,
    conditions,
  });

  const poolConfig = {
    // PoolType.Token == bid-side only
    // PoolType.NFT == list-side only
    // PoolType.Trade == double-sided pool - relist bought NFTs, rebids on NFT sales according to mmFeeBps
    poolType: PoolType.Token,
    // Defines what price curve the pool should follow (exponential/linear)
    // depending on that, "delta" will define either constant price changes (linear)
    // or percentual price changes in BPS (exponential)
    curveType: CurveType.Linear,
    // Pools starting price in lamports (1 SOL == 1_000_000_000 Lamports)
    startingPrice: 1_000_000_000n,
    // if curveType == linear: defines price change in lamports after sale/bid got taken
    // if curveType == exponential: defines price change in BPS of current price after sale/bid got taken
    delta: 500_000_000n,
    // only has an effect if poolType == trade:
    // defines the buy-sell price gap in BPS
    mmFeeBps: null,
    // also only has an effect if poolType == trade:
    // defines whether profits (e.g. after 1+ successful bid/s and sale/s)
    // will go back into sol Vault or will stay seperate (boolean)
    mmCompoundFees: false,
  };

  const { instruction: createPoolIx, pool } = await getCreatePoolIx({
    owner: signer.publicKey,
    whitelist: new PublicKey(whitelist.toString()),
    config: poolConfig,
    poolId,
  });

  const latestBlockhash = await connection.getLatestBlockhash();
  const blockhash = latestBlockhash.blockhash;

  const msg = new TransactionMessage({
    payerKey: signer.publicKey,
    recentBlockhash: blockhash,
    instructions: [createWhitelistIx, createPoolIx],
  }).compileToV0Message();
  const tx = new VersionedTransaction(msg);
  tx.sign([signer, namespace]);

  const sig = await connection.sendTransaction(tx);
  console.log(sig);
}
