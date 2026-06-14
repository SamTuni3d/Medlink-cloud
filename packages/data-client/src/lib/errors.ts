import type { AppError } from './result'
import type { PostgrestError } from '@supabase/supabase-js'

export function toAppError(e: unknown): AppError {
  if (e && typeof e === 'object') {
    // PostgrestError
    if ('code' in e && 'message' in e && 'details' in e) {
      const pgErr = e as PostgrestError
      return {
        code: pgErr.code ?? 'DB_ERROR',
        message: pgErr.message,
        details: pgErr.details,
      }
    }
    // ZodError
    if ('issues' in e) {
      return {
        code: 'VALIDATION_ERROR',
        message: 'Data validation failed',
        details: (e as { issues: unknown }).issues,
      }
    }
    // Generic Error
    if ('message' in e) {
      return {
        code: 'UNKNOWN_ERROR',
        message: (e as Error).message,
      }
    }
  }
  return {
    code: 'UNKNOWN_ERROR',
    message: 'An unexpected error occurred',
    details: e,
  }
}
