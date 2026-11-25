type ResourceError = { code: string; message: string } | null

export function missingDatabaseResource(error: ResourceError, kind: 'table' | 'function', name: string) {
  if (!error) return false
  const codes = kind === 'table' ? ['PGRST205', '42P01'] : ['PGRST202', '42883']
  if (!codes.includes(error.code)) return false
  const object = error.message.replace(/['"]/g, '').match(/\b(?:relation|table|function)\s+(?:public\.)?([a-z_][a-z_0-9]*)\b/i)
  return object?.[1] === name
}
