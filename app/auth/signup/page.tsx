import { AccountPage, type AccountQuery } from '../account-page'

export const metadata = { title: 'Create an account | Clientfind' }

export default async function Signup({ searchParams }: { searchParams: Promise<AccountQuery> }) {
  return <AccountPage mode="signup" query={await searchParams} />
}
