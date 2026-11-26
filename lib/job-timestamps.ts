export function jobTimestamps(postedAt: string, firstFoundAt?: string) {
  const utc = (timestamp: string) => new Date(timestamp).toISOString().slice(0, 19).replace('T', ' ') + ' UTC'
  return 'Posted ' + utc(postedAt) + '\n' +
    (firstFoundAt ? 'First found ' + utc(firstFoundAt) : 'First found time unavailable')
}
