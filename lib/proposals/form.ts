import { proposalSchema } from './model'

function readPrice(value: FormDataEntryValue | null) {
  if (value === '' || value === null) return null
  if (typeof value !== 'string' || !/^\d{1,9}(\.\d{1,2})?$/.test(value)) return Number.NaN
  const [whole, fraction = ''] = value.split('.')
  return Number(whole) * 100 + Number(fraction.padEnd(2, '0'))
}

export function parseProposalForm(form: FormData) {
  const count = Number(form.get('count'))
  return proposalSchema.safeParse({
    brand: form.get('brand'), logo: form.get('logo') || null, recipient: form.get('recipient'), title: form.get('title'),
    scope: form.get('scope'), currency: form.get('currency'), contact: form.get('contact'),
    packages: Array.from({ length: Number.isInteger(count) && count >= 1 && count <= 3 ? count : 0 }, (_, i) => ({
      name: form.get('name' + i), details: form.get('details' + i),
      priceCents: readPrice(form.get('price' + i)), timeline: form.get('timeline' + i),
    })),
  })
}
