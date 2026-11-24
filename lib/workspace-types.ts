export type LeadCrm = {
  assignee_id: string | null
  deal_value_cents: number
  follow_up_on: string | null
  crm_version: number
}

export type WorkspacePerson = { id: string; name: string }
type Membership = { owner_id: string; member_id: string; created_at: string }
type Invitation = {
  id: string
  owner_id: string
  owner_name: string
  email: string
  expires_at: string
}
type ReadTable<T> = { Row: T; Insert: never; Update: never; Relationships: [] }

export type AgencyTables = {
  workspace_members: ReadTable<Membership>
  workspace_invites: ReadTable<Invitation>
}
export type AgencyFunctions = {
  workspace_people: {
    Args: { p_owner: string; p_actor: string }
    Returns: WorkspacePerson[]
  }
  list_workspaces: { Args: { p_actor: string }; Returns: WorkspacePerson[] }
  invite_workspace_member: { Args: { p_owner: string; p_email: string }; Returns: string }
  accept_workspace_invite: { Args: { p_invite: string; p_actor: string }; Returns: boolean }
  pipeline_totals: {
    Args: { p_owner: string | null }
    Returns: {
      found: number
      replied: number
      won: number
      revenue_cents: number
      by_source: { source: string; wins: number; amount_cents: number }[]
    }[]
  }
}
