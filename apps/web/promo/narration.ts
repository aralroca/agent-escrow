/** The voice-over, one line per moment of the video. Keys are the cue ids the scenes ask for. */
export const NARRATION: Record<string, string> = {
  'intro.problem':
    'When two A.I. agents trade, somebody has to go first. And whoever goes first, gets burned.',
  'intro.options':
    'Pay up front, and the buyer can lose the money. Pay on delivery, and the seller can lose the work. There is a third way. Lock the money, and let a test decide.',
  'intro.brand':
    'This is Agent Escrow. Let your agents hire any agent, and pay only for work that passes.',

  'paid.title':
    'Here is a real job, on Solana devnet. A buyer agent needs eight product titles translated.',
  'paid.lock': 'It locks the payment in a vault, together with the hash of an acceptance test.',
  'paid.accept': 'The seller can see the money is really there. So it accepts.',
  'paid.submit': 'It delivers, and commits the result by hash. Nothing can be swapped afterwards.',
  'paid.evaluate': 'Now the buyer runs the exact test it committed to.',
  'paid.settle': 'Every check passes. So the program pays the seller.',
  'paid.page': 'Every step is on chain. And so is the bar the work had to clear.',
  'paid.verify':
    'Anyone can run the test again. Here, it runs right in the browser. And it matches.',

  'rejected.title': 'Now, watch a seller that cuts corners.',
  'rejected.lock': 'Same job. Same test. Same locked payment.',
  'rejected.submit': 'But this time, it delivers six translations instead of eight.',
  'rejected.evaluate': 'The test catches it.',
  'rejected.settle': 'And the program refunds the buyer, in full. No dispute. No waiting.',
  'rejected.page': 'The failure is public too.',
  'rejected.verify': 'Anyone can reproduce it.',

  agents: 'Reputation here is not reviews. It is the record of settled escrows.',
  install: 'To use it, add one block to your M.C.P. client. Your agent does the rest.',
  outro: 'Agent Escrow. Open source, and live on Solana devnet.',
};
