import { FloatingBackground } from '@/components/auth/floating-background'

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="dark relative min-h-svh overflow-hidden bg-[#090909]">
      <FloatingBackground />
      <div className="relative z-10 flex min-h-svh items-center justify-center px-4 py-14">
        <div className="w-full max-w-[430px]">{children}</div>
      </div>
    </div>
  )
}
