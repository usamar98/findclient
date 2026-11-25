const localReasons: Record<string, string> = {
  missing_key: 'the AI scoring key is missing',
  auth: 'the AI provider rejected its credentials',
  quota: 'the AI provider reported a billing or quota limit',
  model: 'the AI provider rejected the model or its configuration',
  pricing: 'model pricing is unavailable',
  cost_guard: 'the request exceeded the model cost allowance',
  invalid_response: 'the AI returned an incomplete or invalid score',
  unavailable: 'the AI provider was temporarily unavailable',
}
const labels: Record<string, string> = {
  queued: 'Queued', running: 'Checking posts', complete: 'Complete', limited: 'Credit limit reached',
  skipped: 'Search paused or source removed', retrying: 'Waiting to retry', expired: 'Retry window ended',
  missing_exa: 'Indexed search key missing', missing_scorer: 'AI scoring key missing',
  continuing: 'More posts queued for scoring', retry_database: 'Retrying a database operation',
  retry_source: 'Retrying the source request', retry_worker: 'Retrying scan processing',
  retry_cooldown: 'Waiting for the source’s rate limit to reset',
  failed_database: 'Database operation failed after retries', failed_worker: 'Scan processing failed after retries',
  failed_source: 'Source request failed after retries', failed_cooldown: 'Source cooldown exceeds the scan window',
  retry_upgrade: 'Waiting for the latest scan database migration. Saved posts will resume after the upgrade.',
  upgrade_required: 'Apply the latest scan database migration to enable text-based scoring',
}
export function isPendingScanState(state: string) {
  return ['queued', 'running', 'retrying', 'continuing'].includes(state) || state.startsWith('retry_') || state.startsWith('continuing_local_')
}
export function scanOutcomeLabel(state: string) {
  const continued = state.startsWith('continuing_local_')
  if (continued || state.startsWith('local_')) {
    const reason = localReasons[state.slice(continued ? 'continuing_local_'.length : 'local_'.length)]
    if (reason) return (continued ? 'Continuing with text-based scoring because ' : 'Completed with text-based scoring because ') + reason
  }
  return labels[state] ?? state
}
