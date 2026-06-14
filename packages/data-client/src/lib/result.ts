export type AppError = {
  code: string
  message: string
  details?: unknown
}

export type Ok<T> = { ok: true; data: T }
export type Err = { ok: false; error: AppError }
export type Result<T> = Ok<T> | Err

export function ok<T>(data: T): Ok<T> {
  return { ok: true, data }
}

export function err(error: AppError): Err {
  return { ok: false, error }
}
