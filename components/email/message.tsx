import {
  Html,
  Head,
  Preview,
  Body,
  Container,
  Heading,
  Img,
  Text,
  Link,
} from 'react-email'
import { absolute } from '@/lib/seo'
export function Message({
  title,
  body,
  items = [],
  url,
}: {
  title: string
  body: string
  items?: { label: string; url: string }[]
  url: string
}) {
  return (
    <Html lang="en">
      <Head />
      <Preview>{title}</Preview>
      <Body
        style={{
          backgroundColor: '#f6f6f6',
          fontFamily: 'Arial, sans-serif',
          color: '#171717',
        }}
      >
        <Container
          style={{ backgroundColor: '#fff', padding: 32, margin: '24px auto' }}
        >
          <Text style={{ fontWeight: 700 }}>
            <Img alt="" src={absolute('/brand/logo-512.png')} width="28" height="28" style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: 8 }} />
            Lead To Client
          </Text>
          <Heading>{title}</Heading>
          <Text>{body}</Text>
          {items.map((i) => (
            <Text key={i.url}>
              <Link href={i.url}>{i.label}</Link>
            </Text>
          ))}
          <Text>
            <Link href={url}>Open your workspace</Link>
          </Text>
        </Container>
      </Body>
    </Html>
  )
}
