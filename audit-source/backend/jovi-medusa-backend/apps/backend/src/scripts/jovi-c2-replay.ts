import runJoviC2 from "./jovi-c2"

export default async function runReplayC2(args: any) {
  // Re-running jovi-c2 uses the existing order and test run ID, asserting idempotency
  await runJoviC2(args)
}
