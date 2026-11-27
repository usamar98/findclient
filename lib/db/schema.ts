import type { NicheInput, statuses, tones } from '@/lib/niche'
import type {
  AgencyTables,
  AgencyFunctions,
  LeadCrm,
} from '@/lib/workspace-types'
import type { ProposalRow, ProposalFunctions } from '@/lib/proposals/model'
import type { WorkflowTables, WorkflowFunctions } from '@/lib/workflow-schema'
import type { SiteReport } from '@/lib/site-audit/analyze'
import type { WorkspaceResult } from '@/lib/workspace-results'
import type { NormalizedPost } from '@/lib/sources/shared'
import type { TrackableJob } from '@/lib/job-tracking-model'
import type { OwnerReport } from '@/lib/owner-model'
export type Product =
  'lifetime' | 'agency' | 'monthly' | 'topup9' | 'topup19' | 'topup29'
type Plan = 'free' | 'lifetime' | 'agency' | 'monthly'
type Profile = {
  id: string
  email: string
  name: string
  plan: Plan
  credits: number
  telegram_chat_id: string | null
  onboarding_done: boolean
  digest_enabled: boolean
  branding: string
  voice_examples: string
  learn_from_edits: boolean
  priority_alert_min: number
  priority_email: boolean
  fast_discovery: boolean
  stripe_customer_id: string | null
  next_refill_at: string | null
  monthly_reply_reserve: number
}
type Niche = Omit<NicheInput, 'portfolio_url'> & {
  id: string
  user_id: string
  portfolio_url: string | null
  last_scanned_at: string | null
  monthly_score_limit: number | null
}
type Lead = LeadCrm & {
  rule_draft_capped?: boolean
  score_method: 'ai' | 'local' | 'manual'
  applied_at: string | null
  id: string
  user_id: string
  niche_id: string | null
  source: string
  url: string
  author: string | null
  title: string
  body: string
  posted_at: string
  intent_score: number | null
  intent_reason: string
  problem_summary: string
  budget_signal: string | null
  urgency: string | null
  buyer_intelligence: unknown | null
  match_feedback: string | null
  match_feedback_at: string | null
  buyer_quality_score: number | null
  status: (typeof statuses)[number]
  created_at: string
}
type Reply = {
  id: string
  user_id: string
  lead_id: string
  solution_md: string
  pitch_md: string
  tone: (typeof tones)[number]
  created_at: string
  voice_author_id: string | null
  voice_edited_at: string | null
  voice_sample: string | null
}
export type LeadAudit = {
  lead_id: string
  target_url: string | null
  status: 'queued' | 'checking' | 'complete' | 'no_site' | 'unavailable'
  report: SiteReport | null
  failure: string | null
  attempts: number
  due_at: string
  lease: string | null
  updated_at: string
}
type Quote = {
  id: string
  user_id: string
  product: Product
  amount: number
  credits: number
  expires_at: string
  stripe_subscription_id: string | null
  subscription_ended: boolean
  paid_through: string | null
  state: 'open' | 'paid' | 'expired'
}
type Usage = {
  id: string
  user_id: string
  request_key: string
  type: string
  cost_credits: number
  created_at: string
  settled_at: string | null
  niche_id: string | null
  source: string | null
  scan_job_id: string | null
  scan_run_id: string | null
}
type Notice = {
  id: string
  user_id: string
  kind: string
  payload: unknown
  event_key: string
  available_at: string
  sent_at: string | null
  attempts: number
}
export type TelegramJobWatch = {
  id: string
  user_id: string
  chat_id: string
  query: string
  started_at: string
  next_check_at: string
}
type HiringSource = 'hn' | 'bluesky'
type HiringStatus = 'checked' | 'cooldown' | 'access' | 'unavailable'
export type HiringListing = {
  title: string; body: string; author: string; tags?: string[]
  engagement: 'paid_freelance' | 'contract_pay_unlisted'; compensation?: string
}
export type HiringObservation = {
  source: string; source_key: string; url: string; posted_at: string; listing?: HiringListing
}
type HiringJobRow = {
  source: string; source_key: string; url: string; posted_at: string
  first_found_at: string; listing: HiringListing | null
}
type HiringSourceState = {
  source: HiringSource; status: HiringStatus; partial: boolean; last_checked_at: string | null
  last_success_at: string | null; next_check_at: string; lease_id: string | null; lease_until: string | null
}
export type ScanJob = {
  id: string
  niche_id: string
  source: string
  scan_hour: string
  available_at: string
  done_at: string | null
  lease: string | null
  attempts: number
  run_id: string | null
  candidates: NormalizedPost[] | null
  outcome: string | null
}
export type ScanRun = { id: string; user_id: string; niche_id: string; service: string; started_at: string; scheduled_for: string | null; credit_limit: number | null }
export type ScanSourceReceipt = {
  job_id: string; run_id: string; source: string; state: string; source_checked: boolean
  local_scored: number
  found: number; scored: number; matched: number; spent: number; drafted: number; draft_skipped: number; retry_at: string | null
}
type Price = { sales: number; price: number; spots: number }
type ForeignKey = {
  foreignKeyName: string
  columns: string[]
  referencedRelation: string
  referencedColumns: string[]
}
type Table<
  Row,
  Required extends keyof Row = never,
  Keys extends ForeignKey[] = [],
> = {
  Row: Row
  Insert: Pick<Row, Required> & Partial<Omit<Row, Required>>
  Update: Partial<Row>
  Relationships: Keys
}
type Owner<Key extends string> = [
  {
    foreignKeyName: Key
    columns: ['user_id']
    referencedRelation: 'profiles'
    referencedColumns: ['id']
  },
]
type Rpc<Args, Returns> = { Args: Args; Returns: Returns }
type NoArgs = Record<PropertyKey, never>
export type Database = {
  public: {
    Tables: WorkflowTables & AgencyTables & {
      lead_proposals: Table<ProposalRow, 'lead_id' | 'document'>
      lead_site_audits: Table<LeadAudit, 'lead_id'>
      alert_destinations: Table<
        { user_id: string; webhook_url: string },
        'user_id' | 'webhook_url'
      >
      profiles: Table<Profile, 'id' | 'email'>
      niches: Table<
        Niche,
        'user_id' | 'skill' | 'keywords' | 'sources',
        Owner<'niches_user_id_fkey'>
      >
      leads: Table<
        Lead,
        | 'user_id'
        | 'niche_id'
        | 'source'
        | 'url'
        | 'title'
        | 'posted_at'
        | 'intent_score'
        | 'intent_reason',
        Owner<'leads_user_id_fkey'>
      >
      responses: Table<
        Reply,
        'user_id' | 'lead_id' | 'solution_md' | 'pitch_md' | 'tone'
      >
      usage_events: Table<
        Usage,
        'user_id' | 'request_key' | 'type' | 'cost_credits'
      >
      purchases: Table<
        {
          id: string
          user_id: string
          stripe_session_id: string
          product: string
          amount: number
          created_at: string
        },
        'user_id' | 'stripe_session_id' | 'product' | 'amount'
      >
      purchase_billing_locations: Table<{
        stripe_session_id: string
        city: string | null
        country: string | null
      }, 'stripe_session_id'>
      checkout_quotes: Table<
        Quote,
        'user_id' | 'product' | 'amount' | 'credits' | 'expires_at',
        Owner<'checkout_quotes_user_id_fkey'>
      >
      product_config: Table<
        { product: Product; price_cents: number; credits: number },
        'product' | 'price_cents' | 'credits'
      >
      rate_limits: Table<
        { key: string; window_end: string; hits: number },
        'key' | 'window_end' | 'hits'
      >
      scan_jobs: Table<ScanJob, 'niche_id' | 'source' | 'scan_hour'>
      scan_runs: Table<ScanRun, 'user_id' | 'niche_id' | 'service', [{
        foreignKeyName: 'scan_runs_niche_id_fkey'
        columns: ['niche_id']
        referencedRelation: 'niches'
        referencedColumns: ['id']
      }]>
      scan_run_sources: Table<ScanSourceReceipt, 'job_id' | 'run_id' | 'source'>
      source_backoffs: Table<
        { source: string; retry_at: string },
        'source' | 'retry_at'
      >
      notifications: Table<Notice, 'user_id' | 'kind' | 'event_key'>
      shared_hiring_jobs: Table<HiringJobRow, 'source' | 'source_key' | 'url' | 'posted_at'>
      shared_hiring_sources: Table<HiringSourceState, 'source'>
      telegram_job_watches: Table<TelegramJobWatch, 'user_id' | 'chat_id' | 'query'>
      telegram_codes: Table<
        { code: string; user_id: string; expires_at: string },
        'code' | 'user_id' | 'expires_at'
      >
    }
    Views: Record<never, never>
    Enums: Record<never, never>
    CompositeTypes: Record<never, never>
    Functions: WorkflowFunctions & AgencyFunctions &
      ProposalFunctions & {
        owner_report: Rpc<{
          p_days: number; p_search: string; p_user_page: number; p_purchase_page: number
        }, OwnerReport>
        record_purchase_location: Rpc<{
          p_receipt: string; p_city: string | null; p_country: string | null
        }, undefined>
        get_job_tracking: Rpc<{ p_urls: string[] }, { id: string; url: string; applied_at: string | null }[]>
        track_inbox_job: Rpc<{ p_owner: string; p_job: TrackableJob; p_applied: boolean }, { id: string; applied_at: string | null }[]>
        mark_inbox_job_applied: Rpc<{ p_actor: string; p_lead: string }, string | null>
        save_alert_settings: Rpc<
          {
            p_user: string
            p_fast: boolean
            p_email: boolean
            p_min: number
            p_webhook: string | null
          },
          undefined
        >
        claim_lead_audits: Rpc<
          { p_lead?: string; p_limit?: number },
          {
            lead_id: string
            target_url: string | null
            lease: string
            attempts: number
            title: string
            body: string
            source_url: string
          }[]
        >
        allow_request: Rpc<
          { p_key: string; p_limit: number; p_window: number },
          boolean
        >
        reserve_usage: Rpc<
          { p_user: string; p_key: string; p_type: string; p_cost: number },
          boolean
        >
        refund_usage: Rpc<{ p_user: string; p_key: string }, undefined>
        finalize_score: Rpc<
          {
            p_user: string
            p_key: string
            p_lead:
              | (Omit<
                  Lead,
                  | 'id'
                  | 'user_id'
                  | 'status'
                  | 'created_at'
                  | 'match_feedback'
                  | 'match_feedback_at'
                  | 'buyer_quality_score'
                  | 'buyer_intelligence'
                  | keyof LeadCrm
                > & { buyer_intelligence?: unknown })
              | null
          },
          boolean
        >
        finalize_reply: Rpc<
          {
            p_user: string
            p_key: string
            p_lead: string
            p_id: string
            p_tone: (typeof tones)[number]
            p_solution: string
            p_pitch: string
          },
          boolean
        >
        save_niche: Rpc<
          { p_user: string; p_id: string | null; p_data: NicheInput },
          string
        >
        lifetime_price: Rpc<NoArgs, Price[]>
        workspace_results: Rpc<{ p_owner: string; p_group: 'platform' | 'search' }, WorkspaceResult[]>
        create_quote: Rpc<{ p_user: string; p_product: Product }, Quote>
        fulfill_checkout: Rpc<
          {
            p_quote: string
            p_session: string
            p_amount: number
            p_user: string
            p_customer: string
          },
          boolean
        >
        enqueue_scans: Rpc<NoArgs, number>
        apply_subscription_invoice: Rpc<
          {
            p_quote: string
            p_invoice: string
            p_subscription: string
            p_customer: string
            p_amount: number
            p_period_end: string
          },
          boolean
        >
        end_subscription: Rpc<
          {
            p_quote: string
            p_subscription: string
            p_customer: string
          },
          undefined
        >
        claim_scan_jobs: Rpc<{ p_limit: number }, ScanJob[]>
        claim_run_scan_jobs: Rpc<{ p_run: string; p_limit: number }, ScanJob[]>
        start_manual_scan: Rpc<{ p_user: string; p_niche: string; p_request: string; p_limit: number }, string>
        scan_allowance: Rpc<{ p_run: string }, number>
        save_scan_budget: Rpc<{ p_user: string; p_niche: string | null; p_limit: number | null }, undefined>
        monthly_scan_usage: Rpc<NoArgs, { niche_id: string | null; kind: string; credits: number }[]>
        reserve_scan_score: Rpc<{ p_job: string; p_lease: string; p_key: string }, string>
        finalize_scan_score: Rpc<{ p_user: string; p_key: string; p_lead: Record<string, unknown> | null }, boolean>
        finalize_local_score: Rpc<{ p_job: string; p_lease: string; p_key: string; p_lead: Record<string, unknown> | null }, 'matched' | 'unmatched' | 'skipped'>
        defer_source: Rpc<{ p_source: string; p_until: string }, undefined>
        refill_credits: Rpc<NoArgs, undefined>
        link_telegram: Rpc<{ p_code: string; p_chat: string }, boolean>
        record_job_discoveries: Rpc<{ p_jobs: HiringObservation[] },
          { source: string; url: string; first_found_at: string }[]>
        claim_shared_hiring_sources: Rpc<{ p_sources: HiringSource[] }, { source: HiringSource; lease_id: string }[]>
        complete_shared_hiring_source: Rpc<{
          p_source: HiringSource; p_lease: string; p_status: HiringStatus; p_partial: boolean
          p_retry_at: string | null; p_jobs: HiringObservation[]; p_withdrawn?: string[]
        }, boolean>
        set_telegram_job_watch: Rpc<{ p_user: string; p_chat: string; p_query: string | null }, undefined>
        claim_telegram_job_watches: Rpc<{ p_limit: number }, TelegramJobWatch[]>
        queue_digests: Rpc<NoArgs, undefined>
        claim_notifications: Rpc<{ p_limit: number }, Notice[]>
      }
  }
}
