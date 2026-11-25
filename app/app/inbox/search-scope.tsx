'use client'

import { useState } from 'react'

type Props = {
  workspace?: string
  service?: string
  spaces: { id: string; name: string }[]
  searches: { id: string; user_id: string; skill: string }[]
}

export function SearchScope({ workspace = '', service = '', spaces, searches }: Props) {
  const [owner, setOwner] = useState(workspace)
  const [search, setSearch] = useState(service)
  const filtered = searches.filter(row => !owner || row.user_id === owner)
  return <>
    {spaces.length > 1 && <label>Workspace
      <select name="workspace" value={owner} onChange={e => {
        const next = e.target.value
        setOwner(next)
        if (next && !searches.some(row => row.id === search && row.user_id === next)) setSearch('')
      }}>
        <option value="">All workspaces</option>
        {spaces.map(space => <option key={space.id} value={space.id}>{space.name}</option>)}
      </select>
    </label>}
    {spaces.length === 1 && workspace && <input type="hidden" name="workspace" value={workspace} />}
    <label>Service search
      <select name="service" value={search} onChange={e => setSearch(e.target.value)}>
        <option value="">All saved searches</option>
        {filtered.map(row => {
          const name = !owner && spaces.length > 1 && spaces.find(space => space.id === row.user_id)?.name
          return <option key={row.id} value={row.id}>{row.skill}{name && ' · ' + name}</option>
        })}
      </select>
    </label>
  </>
}
