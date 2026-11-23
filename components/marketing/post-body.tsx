import { MDXRemote } from 'next-mdx-remote/rsc'
import remarkGfm from 'remark-gfm'
import { headingId } from '@/lib/posts'
import { Children, isValidElement, type ReactNode } from 'react'

function nodeText(value: ReactNode): string {
  return Children.toArray(value)
    .map((child) =>
      isValidElement<{ children?: ReactNode }>(child)
        ? nodeText(child.props.children)
        : String(child),
    )
    .join('')
}
export function PostBody({ source }: { source: string }) {
  return (
    <div className="guide-prose">
      <MDXRemote
        source={source}
        options={{ mdxOptions: { remarkPlugins: [remarkGfm] } }}
        components={{
          h2: ({ children }) => (
            <h2 id={headingId(nodeText(children))}>{children}</h2>
          ),
          table: ({ children }) => (
            <div className="guide-table">
              <table>{children}</table>
            </div>
          ),
        }}
      />
    </div>
  )
}
