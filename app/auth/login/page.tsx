import { AccountPage, type AccountQuery } from '../account-page'

export default async function Login({ searchParams }: { searchParams: Promise<AccountQuery> }) {
  return <AccountPage mode="login" query={await searchParams} />
}
