import 'server-only'
import { readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'
import matter from 'gray-matter'
import { z } from 'zod'

const meta = z.object({
  slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  title: z.string().min(1).max(60),
  description: z.string().min(1).max(155),
  category: z.string().min(1),
  tags: z.array(z.string().min(1)).min(1),
  published: z.iso.date(),
  updated: z.iso.date(),
  author: z.string().min(1),
  quickAnswer: z.string().min(1),
  procedure: z
    .object({
      name: z.string().min(1),
      sections: z.array(z.string().min(1)).min(2),
    })
    .optional(),
})
export function headingId(text: string) {
  return text
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
}
export type Post = z.infer<typeof meta> & {
  body: string
  minutes: number
  toc: { title: string; id: string; summary: string }[]
}
const directory = path.join(process.cwd(), 'content', 'blog')
function readPost(filename: string): Post {
  const { content, data } = matter(
    readFileSync(path.join(directory, filename), 'utf8'),
  )
  const front = meta.parse(data)
  if (filename !== front.slug + '.mdx')
    throw new Error('Blog filename must match slug: ' + filename)
  const toc = Array.from(
    content.matchAll(/^## (.+)\r?\n(?:\s*\n)([^\r\n]+)/gm),
    (match) => {
      const title = match[1].trim()
      return {
        title,
        id: headingId(title),
        summary: match[2].replace(/\[([^\]]+)\]\([^)]+\)/g, '$1').trim(),
      }
    },
  )
  const words = content
    .replace(/\]\([^)]+\)/g, ']')
    .trim()
    .split(/\s+/).length
  if (
    front.procedure?.sections.some((id) => !toc.some((entry) => entry.id === id))
  )
    throw new Error('Guide procedure references an unknown heading in ' + filename)
  return {
    ...front,
    body: content,
    minutes: Math.max(1, Math.ceil(words / 220)),
    toc,
  }
}
let loaded: Post[] | undefined
export function posts(): Post[] {
  if (loaded && process.env.NODE_ENV === 'production') return loaded
  loaded = readdirSync(directory)
    .filter((n) => n.endsWith('.mdx'))
    .map(readPost)
    .sort(
      (a, b) =>
        b.published.localeCompare(a.published) ||
        a.title.localeCompare(b.title),
    )
  return loaded
}
export const getPost = (slug: string) => posts().find((p) => p.slug === slug)
export const postSlugs = () => posts().map((p) => p.slug)
export function relatedPosts(post: Post) {
  const overlap = (p: Post) =>
    p.tags.filter((tag) => post.tags.includes(tag)).length +
    Number(p.category === post.category)
  return posts()
    .filter((p) => p.slug !== post.slug)
    .sort((a, b) => overlap(b) - overlap(a) || a.title.localeCompare(b.title))
    .slice(0, 2)
}
