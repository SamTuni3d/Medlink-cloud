export function formatCurrency(amount: number, currencyCode: string): string {
  return new Intl.NumberFormat('en-GH', {
    style: 'currency',
    currency: currencyCode,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount)
}
