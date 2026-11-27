// Each group is required. Alternatives within a group describe the same skill or role.
// Keep them literal so the inbox can use the same groups before database pagination.
const skillAliases = [
  ['frontend', 'front end'], ['backend', 'back end'], ['fullstack', 'full stack'],
  ['react', 'reactjs', 'react.js'], ['vue', 'vuejs', 'vue.js'], ['node', 'nodejs', 'node.js'],
  ['nextjs', 'next.js'], ['javascript', 'js'], ['typescript', 'ts'],
  ['postgres', 'postgresql'], ['kubernetes', 'k8s'], ['dotnet', '.net'],
  ['wordpress', 'wp'], ['shopify', 'shopify plus'],
]

const developerTitles = ['developer', 'engineer', 'programmer', 'dev']
const titleAliases = [
  developerTitles,
  ['designer'], ['writer'], ['editor'], ['consultant'], ['specialist'], ['marketer'],
  ['analyst'], ['architect'], ['translator'], ['illustrator'], ['copywriter'],
]

const pluralForms = (words: string[]) => words.flatMap(word => [word, word + 's'])
const roleWords = titleAliases.map(pluralForms)
const developerRoles = new Set(pluralForms(developerTitles))
const otherEngineering = new Set(['civil', 'mechanical', 'chemical', 'electrical', 'structural', 'aerospace',
  'environmental', 'industrial', 'materials', 'biomedical', 'petroleum', 'geotechnical', 'sales', 'solutions'])
const softwareQueries = new Set(pluralForms(['software engineer', 'software developer', 'software programmer', 'swe', 'sde']))
const softwareAreas = ['front end', 'frontend', 'back end', 'backend', 'full stack', 'fullstack', 'web', 'mobile', 'ios',
  'android', 'python', 'java', 'javascript', 'react', 'node.js', 'typescript', '.net', 'rust', 'go', 'c++', 'c#', 'ruby', 'php']
const softwareTitles = [
  ...softwareQueries, ...pluralForms(['software development engineer', 'software dev', 'programmer']),
  ...softwareAreas.flatMap(area => pluralForms([area + ' developer', area + ' engineer'])),
]

export function titleWords(text: string): string[] {
  return text.normalize('NFKC').toLowerCase()
    .match(/\.?[\p{L}\p{N}]+(?:\.[\p{L}\p{N}]+)*(?:\+\+|#)?/gu) ?? []
}

export function validJobKeyword(text: string) {
  return text.length <= 100 && ((text.length >= 2 && titleWords(text).length > 0) || /^[cr]$/i.test(text))
}

const aliases = new Map([...skillAliases, ...roleWords].flatMap(group =>
  group.map(term => [term, group] as const)))

export function softwareRoleQueries(query: string): string[] {
  if (query.includes('"')) return []
  const words = titleWords(query)
  const role = words.pop() ?? ''
  if (!developerRoles.has(role)) return []
  const skill = words.join(' ')
  const variants = aliases.get(skill) ?? [skill]
  const area = variants.find(term => softwareAreas.includes(term))
  if (!area) return []
  return [area + ' developer', area + ' engineer']
}

export function titleSearchGroups(query: string): string[][] {
  const groups: string[][] = []
  for (const [part, quoted] of query.matchAll(/"([^"]+)"|[^"]+/g)) {
    const words = titleWords(quoted ?? part)
    if (quoted !== undefined) {
      if (words.length) groups.push([words.join(' ')])
      continue
    }
    for (let index = 0; index < words.length; index++) {
      const term = words[index]
      const pair = term + ' ' + words[index + 1]
      if (softwareQueries.has(pair)) {
        groups.push(softwareTitles)
        index++
      } else if (otherEngineering.has(term) && /^(?:engineers?|developers?)$/.test(words[index + 1] ?? '')) {
        groups.push([term], pluralForms([words[index + 1].replace(/s$/, '')]))
        index++
      } else if (aliases.has(pair)) {
        groups.push(aliases.get(pair)!)
        index++
      } else {
        groups.push(softwareQueries.has(term) ? softwareTitles : aliases.get(term) ?? [term])
      }
    }
  }
  return [...new Set(groups)]
}

export function matchesTitleGroups(groups: string[][], ...fields: string[]) {
  // Phrases can't begin in one field and finish in a different field.
  const sequence = fields.map(field => ' ' + titleWords(field).join(' ') + ' ').join('\n')
  return groups.length > 0 && groups.every(group =>
    group.some(term => sequence.includes(' ' + term + ' ')))
}
