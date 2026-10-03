import { seed } from '../../../../e2e/seed.ts';
import startValidator from '../../../../e2e/validator.ts';

/** Starts a local validator, seeds it, and hands the job addresses to the tests through env. */
export default async function globalSetup() {
  // The validator loads the program from a path relative to the repository root.
  process.chdir(new URL('../../../../', import.meta.url).pathname);
  const stopValidator = await startValidator();
  const { completed, rejected, funded, close } = await seed();

  Object.assign(process.env, {
    JOB_COMPLETED: completed,
    JOB_REJECTED: rejected,
    JOB_FUNDED: funded,
  });

  return () => {
    close();
    stopValidator();
  };
}
