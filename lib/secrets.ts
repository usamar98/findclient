import { timingSafeEqual, createHash } from 'node:crypto'
export function matchesSecret(
  input: string | null,
  expected: string | undefined,
) {
  if (!expected || !input) return false
  const digest = (s: string) => createHash('sha256').update(s).digest()
  return timingSafeEqual(digest(input), digest(expected))
}
