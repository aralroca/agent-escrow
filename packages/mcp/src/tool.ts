import { address, isAddress } from '@solana/kit';
import * as z from 'zod/v4';
import type { Context } from './context.ts';

export type Tool<Input extends z.ZodObject = z.ZodObject> = {
  name: string;
  description: string;
  input: Input;
  run: (context: Context, args: z.infer<Input>) => Promise<unknown>;
};

/** Identity helper that ties a tool's handler arguments to its input schema. */
export function defineTool<Input extends z.ZodObject>(tool: Tool<Input>): Tool<Input> {
  return tool;
}

export const addressSchema = z
  .string()
  .refine(isAddress, 'Must be a base58 Solana address')
  .transform((value) => address(value));

export const jobSchema = addressSchema.describe('Address of the job account');
