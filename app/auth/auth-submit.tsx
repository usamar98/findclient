'use client'
import { useFormStatus } from 'react-dom'

export function AuthSubmit({ google = false, signup = false }: { google?: boolean; signup?: boolean }) {
  const { pending } = useFormStatus()
  return <button type="submit" className={google ? 'auth-google' : 'auth-submit'} disabled={pending}>
    {google && <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
      <path d="M21.8 12.23c0-.71-.06-1.39-.18-2.05H12v3.88h5.5a4.69 4.69 0 0 1-2.04 3.08v2.56h3.3c1.94-1.79 3.04-4.42 3.04-7.47Z" />
      <path d="M12 22c2.75 0 5.05-.91 6.74-2.47l-3.3-2.56c-.91.61-2.07.98-3.44.98-2.66 0-4.92-1.79-5.73-4.2H2.86v2.64A10.18 10.18 0 0 0 12 22Z" />
      <path d="M6.27 13.75a6.03 6.03 0 0 1 0-3.85V7.26H2.86a10.1 10.1 0 0 0 0 9.13l3.41-2.64Z" />
      <path d="M12 5.7c1.5 0 2.83.52 3.89 1.52l2.92-2.92A9.85 9.85 0 0 0 12 1.65a10.18 10.18 0 0 0-9.14 5.61L6.27 9.9C7.08 7.49 9.34 5.7 12 5.7Z" />
    </svg>}
    {pending ? (google ? 'Connecting…' : 'Sending link…') : google ? 'Continue with Google' : signup ? 'Email me a sign-up link' : 'Email me a sign-in link'}
  </button>
}
