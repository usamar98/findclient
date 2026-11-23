'use client'
export default function ErrorPage({
  reset,
}: {
  error: Error
  reset: () => void
}) {
  return (
    <main className="workspace">
      <section className="panel">
        <h1>Something went wrong</h1>
        <p>Your request could not be completed. Please try again.</p>
        <button onClick={reset}>Try again</button>
      </section>
    </main>
  )
}
