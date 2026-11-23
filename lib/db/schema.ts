import type { NicheInput, statuses, tones } from '@/lib/niche'
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
  stripe_customer_id: string | null
  next_refill_at: string | null
}
type Niche = Omit<NicheInput, 'portfolio_url'> & {
  id: string
  user_id: string
  portfolio_url: string | null
  last_scanned_at: string | null
}
type Lead = {
  id: string
  user_id: string
  niche_id: string
  source: string
  url: string
  author: string | null
  title: string
  body: string
  posted_at: string
  intent_score: number
  intent_reason: string
  problem_summary: string
  budget_signal: string | null
  urgency: string | null
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
export type ScanJob = {
  id: string
  niche_id: string
  source: string
  scan_hour: string
  available_at: string
  done_at: string | null
  lease: string | null
  attempts: number
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
    Tables: {
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
      source_backoffs: Table<
        { source: string; retry_at: string },
        'source' | 'retry_at'
      >
      notifications: Table<Notice, 'user_id' | 'kind' | 'event_key'>
      telegram_codes: Table<
        { code: string; user_id: string; expires_at: string },
        'code' | 'user_id' | 'expires_at'
      >
    }
    Views: Record<never, never>
    Enums: Record<never, never>
    CompositeTypes: Record<never, never>
    Functions: {
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
          p_lead: Omit<Lead, 'id' | 'user_id' | 'status' | 'created_at'> | null
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
      defer_source: Rpc<{ p_source: string; p_until: string }, undefined>
      refill_credits: Rpc<NoArgs, undefined>
      link_telegram: Rpc<{ p_code: string; p_chat: string }, boolean>
      queue_digests: Rpc<NoArgs, undefined>
      claim_notifications: Rpc<{ p_limit: number }, Notice[]>
    }
  }
}
