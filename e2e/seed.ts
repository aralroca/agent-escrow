import { acceptJob, createJob, evaluateJob, registerAgent, submitResult } from '@agent-escrow/sdk';
import type { Address } from '@solana/kit';
import { products, spec } from './fixtures.ts';
import { connection, createMint, fundedSigner, mintTo, serveFiles, USDC } from './world.ts';

export type Seeded = { completed: Address; rejected: Address; funded: Address; close: () => void };

const inOneHour = () => BigInt(Math.floor(Date.now() / 1000) + 3_600);

/**
 * Puts a small, realistic history on the local validator: one seller, and three jobs that ended
 * paid, refunded and still waiting. Used by the browser tests and by `pnpm dev:chain`.
 */
export async function seed(): Promise<Seeded> {
  const [buyer, seller] = await Promise.all([fundedSigner(), fundedSigner()]);
  const mint = await createMint(buyer);
  const files = await serveFiles();
  const specUri = files.host('spec.json', spec);
  const hire = () =>
    createJob(connection, buyer, {
      provider: seller.address,
      amount: 30n * USDC,
      specUri,
      deadline: inOneHour(),
      mint,
    });
  const deliver = async (name: string, result: unknown) => {
    const { job } = await hire();

    await acceptJob(connection, seller, job);
    await submitResult(connection, seller, job, files.host(name, result));
    await evaluateJob(connection, buyer, job);

    return job;
  };

  await mintTo(buyer, mint, buyer.address, 1_000n * USDC);
  await registerAgent(connection, buyer, { name: 'shop-ops' });
  await registerAgent(connection, seller, { name: 'lingua-7', capabilities: ['translation'] });

  return {
    completed: await deliver('good.json', products),
    rejected: await deliver('short.json', products.slice(0, 2)),
    funded: (await hire()).job,
    close: files.close,
  };
}
