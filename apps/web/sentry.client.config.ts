import * as Sentry from '@sentry/nextjs'

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Capture 10 % of sessions for performance tracing in production;
  // capture everything in other environments.
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,

  // Capture replays for 10 % of sessions, and 100 % of sessions with errors.
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,

  integrations: [
    Sentry.replayIntegration({
      // Mask all text and inputs to protect patient / prescription data.
      maskAllText: true,
      blockAllMedia: true,
    }),
  ],

  // Don't send events in development.
  enabled: process.env.NODE_ENV === 'production',
})
