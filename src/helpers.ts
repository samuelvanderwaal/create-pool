import { PublicKey, TransactionInstruction } from "@solana/web3.js";
import { address, createNoopSigner } from "@solana/web3.js-next";
import {
  findPoolPda,
  getCreatePoolInstructionAsync,
  PoolConfigArgs,
} from "@tensor-foundation/amm";
import { fromIInstructionToTransactionInstruction } from "@tensor-foundation/compat-helpers";
import {
  ConditionArgs,
  getCreateWhitelistV2InstructionAsync,
} from "@tensor-foundation/whitelist";
import { v4 } from "uuid";

export const generateUuid = () => uuidToUint8Array(v4());

export const uuidToUint8Array = (uuid: string) => {
  const encoder = new TextEncoder();
  // replace any '-' to handle uuids
  return encoder.encode(uuid.replace(/-/g, ""));
};

export const nameToUint8Array = (name: string) => {
  const encoder = new TextEncoder();
  const encodedName = encoder.encode(name);
  const paddedName = new Uint8Array(32);
  paddedName.set(encodedName);
  return paddedName;
};

export interface InstructionReturn {
  instruction: TransactionInstruction;
}

export interface CreatePoolInstructionReturn extends InstructionReturn {
  pool: PublicKey;
  poolId: Uint8Array;
}

export const getCreatePoolIx = async ({
  owner,
  whitelist,
  config,
  makerBroker,
  maxTakerSellCount,
  poolId,
}: {
  owner: PublicKey;
  whitelist: PublicKey;
  config: PoolConfigArgs;
  makerBroker?: PublicKey;
  maxTakerSellCount?: number;
  poolId?: Uint8Array | string;
}): Promise<CreatePoolInstructionReturn> => {
  if (!poolId) {
    poolId = generateUuid();
  }

  if (typeof poolId === "string") {
    poolId = nameToUint8Array(poolId);
  }

  const [pool] = await findPoolPda({
    owner: address(owner.toString()),
    poolId,
  });

  const ix = await getCreatePoolInstructionAsync({
    owner: createNoopSigner(address(owner.toString())),
    pool,
    whitelist: address(whitelist.toString()),
    config,
    makerBroker: makerBroker ? address(makerBroker.toString()) : undefined,
    maxTakerSellCount,
    poolId,
  });

  return {
    instruction: fromIInstructionToTransactionInstruction(ix),
    pool: new PublicKey(pool.toString()),
    poolId,
  };
};

export const createWhitelistV2 = async ({
  payer,
  updateAuthority,
  namespace,
  uuid,
  freezeAuthority,
  conditions,
}: {
  payer: PublicKey;
  updateAuthority: PublicKey;
  namespace: PublicKey;
  uuid: string;
  freezeAuthority: PublicKey;
  conditions: ConditionArgs[];
}): Promise<TransactionInstruction> => {
  const createWhitelistV2Ix = await getCreateWhitelistV2InstructionAsync({
    payer: createNoopSigner(address(payer.toString())),
    updateAuthority: createNoopSigner(address(updateAuthority.toString())),
    namespace: createNoopSigner(address(namespace.toString())),
    uuid: uuidToUint8Array(uuid),
    freezeAuthority: address(freezeAuthority.toString()),
    conditions,
  });

  return fromIInstructionToTransactionInstruction(createWhitelistV2Ix);
};
