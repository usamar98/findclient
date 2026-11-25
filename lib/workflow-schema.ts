export type LeadRule = {
  id: string
  user_id: string
  name: string
  enabled: boolean
  niche_id: string | null
  source: string | null
  min_score: number
  require_budget: boolean
  assignee_id: string | null
  draft_reply: boolean
  telegram: boolean
  created_at: string
}
export type Followup = {
  lead_id: string
  due_at: string
  draft: string | null
  cancelled_at: string | null
  prepared_at: string | null
}
type SequenceSettings = { user_id: string; enabled: boolean; delay_days: number }
type Table<Row, Required extends keyof Row> = {
  Row: Row
  Insert: Pick<Row, Required> & Partial<Row>
  Update: Partial<Row>
  Relationships: []
}
export type WorkflowTables = {
  lead_rules: Table<LeadRule,'user_id' | 'name'>
  proposal_followups: Table<Followup,'lead_id' | 'due_at'>
  proposal_workflow_settings: Table<SequenceSettings,'user_id'>
}
export type WorkflowFunctions = {
  reserve_rule_draft: { Args: { p_notice: string }; Returns: string }
  prepare_proposal_followups: { Args: Record<PropertyKey, never>; Returns: number }
}
