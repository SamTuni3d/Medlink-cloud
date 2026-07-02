'use client'

import { useEffect, useRef } from 'react'

export function FloatingBackground() {
  const parallaxRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = parallaxRef.current
    if (!el) return

    let rafId: number
    let targetX = 0, targetY = 0
    let currentX = 0, currentY = 0

    function onMouseMove(e: MouseEvent) {
      targetX = (e.clientX / window.innerWidth  - 0.5) * 22
      targetY = (e.clientY / window.innerHeight - 0.5) * 22
    }

    function lerp(a: number, b: number, t: number) { return a + (b - a) * t }

    function tick() {
      currentX = lerp(currentX, targetX, 0.04)
      currentY = lerp(currentY, targetY, 0.04)
      el!.style.transform = `translate(${currentX.toFixed(2)}px, ${currentY.toFixed(2)}px)`
      rafId = requestAnimationFrame(tick)
    }

    window.addEventListener('mousemove', onMouseMove, { passive: true })
    rafId = requestAnimationFrame(tick)

    return () => {
      window.removeEventListener('mousemove', onMouseMove)
      cancelAnimationFrame(rafId)
    }
  }, [])

  return (
    <div className="pointer-events-none fixed inset-0 overflow-hidden" aria-hidden="true">
      {/* Parallax blob layer — moves gently with cursor */}
      <div ref={parallaxRef} className="absolute inset-[-4%] will-change-transform">
        <div className="auth-blob-1 absolute left-[14%] top-[18%] h-[700px] w-[700px] rounded-full bg-blue-600/[0.13] blur-[150px]" />
        <div className="auth-blob-2 absolute right-[8%]  bottom-[12%] h-[620px] w-[620px] rounded-full bg-cyan-500/[0.08] blur-[130px]" />
        <div className="auth-blob-3 absolute left-[52%] top-[52%]  h-[480px] w-[480px] rounded-full bg-indigo-500/[0.07] blur-[110px]" />
      </div>

      {/* Subtle perspective grid */}
      <div
        className="absolute inset-0 opacity-[0.022]"
        style={{
          backgroundImage:
            'linear-gradient(rgba(255,255,255,1) 1px,transparent 1px),' +
            'linear-gradient(90deg,rgba(255,255,255,1) 1px,transparent 1px)',
          backgroundSize: '72px 72px',
        }}
      />

      {/* Floating medical crosses */}
      <span className="auth-float   absolute left-[6%]  top-[11%]  select-none text-5xl text-white/[0.035]">✚</span>
      <span className="auth-float-b absolute right-[7%] bottom-[16%] select-none text-4xl text-white/[0.025]">✚</span>
      <span className="auth-float   absolute left-[3%]  top-[62%]  select-none text-3xl text-white/[0.02]">✚</span>
      <span className="auth-float-b absolute right-[11%] top-[22%] select-none text-2xl text-white/[0.02]">✚</span>

      {/* Top-centre radial spotlight */}
      <div className="absolute left-1/2 top-0 h-px w-[60%] -translate-x-1/2 bg-gradient-to-r from-transparent via-blue-500/20 to-transparent" />
      <div className="absolute left-1/2 top-0 h-72 w-[50%] -translate-x-1/2 rounded-full bg-blue-600/[0.06] blur-[80px]" />
    </div>
  )
}
