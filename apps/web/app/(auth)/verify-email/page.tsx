import Link from 'next/link'

export default function VerifyEmailPage() {
  return (
    <div className="rounded-xl border bg-card p-8 shadow-sm text-center">
      <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
        <span className="text-2xl text-primary">✉</span>
      </div>
      <h1 className="text-xl font-bold">Verify your email</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        We sent a confirmation link to your email address. Click it to activate
        your account.
      </p>
      <p className="mt-4 text-xs text-muted-foreground">
        Didn&apos;t receive it? Check your spam folder or{' '}
        <Link
          href="/register"
          className="font-medium text-primary hover:underline"
        >
          try again
        </Link>
        .
      </p>
    </div>
  )
}
