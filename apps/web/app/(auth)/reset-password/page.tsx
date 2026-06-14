'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { createClient } from '@/lib/supabase/client'

const schema = z
  .object({
    password: z.string().min(8, 'Password must be at least 8 characters'),
    confirmPassword: z.string(),
  })
  .refine(d => d.password === d.confirmPassword, {
    path: ['confirmPassword'],
    message: 'Passwords do not match',
  })

type FormValues = z.infer<typeof schema>

export default function ResetPasswordPage() {
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { password: '', confirmPassword: '' },
  })

  function onSubmit(values: FormValues) {
    startTransition(async () => {
      const supabase = createClient()
      const { error } = await supabase.auth.updateUser({
        password: values.password,
      })
      if (error) {
        form.setError('root', { message: error.message })
      } else {
        router.push('/dashboard')
      }
    })
  }

  return (
    <div className="rounded-xl border bg-card p-8 shadow-sm">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-primary">Set new password</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Choose a strong password for your account
        </p>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <FormField
            control={form.control}
            name="password"
            render={({ field }) => (
              <FormItem>
                <FormLabel>New password</FormLabel>
                <FormControl>
                  <Input
                    type="password"
                    autoComplete="new-password"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="confirmPassword"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Confirm new password</FormLabel>
                <FormControl>
                  <Input
                    type="password"
                    autoComplete="new-password"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {form.formState.errors.root && (
            <p className="text-sm text-destructive">
              {form.formState.errors.root.message}
            </p>
          )}

          <Button type="submit" className="w-full" disabled={isPending}>
            {isPending ? 'Updating…' : 'Update password'}
          </Button>
        </form>
      </Form>
    </div>
  )
}
