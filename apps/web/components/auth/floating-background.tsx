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
      targetX = (e.clientX / window.innerWidth  - 0.5) * 12
      targetY = (e.clientY / window.innerHeight - 0.5) * 12
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
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">

      {/* ── Crisp floating pill shapes ── */}
      <div ref={parallaxRef} className="absolute inset-[-3%] will-change-transform">
        {/* Top-right tall pill */}
        <div className="absolute right-[-4%] top-[-8%] h-[520px] w-[180px] rotate-[28deg] rounded-[90px] border border-white/[0.10] bg-white/[0.05]" />
        {/* Mid-right second pill */}
        <div className="absolute right-[18%] top-[22%] h-[420px] w-[150px] rotate-[40deg] rounded-[75px] border border-white/[0.07] bg-white/[0.04]" />
        {/* Left tall pill */}
        <div className="absolute left-[-6%] top-[35%] h-[380px] w-[140px] rotate-[-18deg] rounded-[70px] border border-white/[0.07] bg-white/[0.04]" />
        {/* Bottom-left small pill */}
        <div className="absolute bottom-[-5%] left-[22%] h-[300px] w-[120px] rotate-[50deg] rounded-[60px] border border-white/[0.06] bg-white/[0.03]" />
        {/* Centre-right circle accent */}
        <div className="absolute right-[8%] bottom-[15%] h-[220px] w-[220px] rounded-full border border-white/[0.07] bg-white/[0.03]" />
        {/* Top-left thin pill */}
        <div className="absolute left-[30%] top-[-5%] h-[260px] w-[90px] rotate-[15deg] rounded-[45px] border border-white/[0.06] bg-white/[0.03]" />
      </div>

      {/* Subtle grid */}
      <div
        className="absolute inset-0 opacity-[0.025]"
        style={{
          backgroundImage:
            'linear-gradient(rgba(255,255,255,1) 1px,transparent 1px),' +
            'linear-gradient(90deg,rgba(255,255,255,1) 1px,transparent 1px)',
          backgroundSize: '72px 72px',
        }}
      />
    </div>
  )
}
