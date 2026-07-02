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
      targetX = (e.clientX / window.innerWidth  - 0.5) * 18
      targetY = (e.clientY / window.innerHeight - 0.5) * 18
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

      {/* ── Purple dome glow anchored to the bottom — image 1 ── */}
      <div className="auth-dome-pulse absolute bottom-[-8%] left-1/2 h-[520px] w-[900px] -translate-x-1/2 rounded-[50%] bg-purple-700/40 blur-[110px]" />
      {/* Bright centre of the dome */}
      <div className="auth-dome-pulse absolute bottom-[-12%] left-1/2 h-[320px] w-[500px] -translate-x-1/2 rounded-[50%] bg-purple-400/20 blur-[70px]" style={{ animationDelay: '1s' }} />

      {/* ── Flowing ribbon waves — image 2 ── */}
      {/* Each wave is a wide blurred strip angled slightly, animated independently */}
      <div
        className="auth-wave-1 absolute left-[-15%] top-[28%] h-[160px] w-[130%] rounded-[50%] blur-[55px]"
        style={{ background: 'linear-gradient(90deg, transparent 0%, rgba(126,34,206,0.45) 30%, rgba(168,85,247,0.55) 50%, rgba(126,34,206,0.45) 70%, transparent 100%)' }}
      />
      <div
        className="auth-wave-2 absolute left-[-15%] top-[40%] h-[120px] w-[130%] rounded-[50%] blur-[45px]"
        style={{ background: 'linear-gradient(90deg, transparent 0%, rgba(109,40,217,0.35) 25%, rgba(192,132,252,0.45) 50%, rgba(109,40,217,0.35) 75%, transparent 100%)' }}
      />
      <div
        className="auth-wave-3 absolute left-[-15%] top-[50%] h-[140px] w-[130%] rounded-[50%] blur-[50px]"
        style={{ background: 'linear-gradient(90deg, transparent 0%, rgba(88,28,135,0.4) 30%, rgba(147,51,234,0.5) 55%, rgba(88,28,135,0.4) 70%, transparent 100%)' }}
      />

      {/* ── Parallax ambient blobs ── */}
      <div ref={parallaxRef} className="absolute inset-[-4%] will-change-transform">
        <div className="auth-blob-1 absolute left-[12%] top-[15%] h-[600px] w-[600px] rounded-full bg-purple-800/[0.18] blur-[140px]" />
        <div className="auth-blob-2 absolute right-[8%]  bottom-[20%] h-[500px] w-[500px] rounded-full bg-violet-700/[0.12] blur-[120px]" />
        <div className="auth-blob-3 absolute left-[50%] top-[45%]  h-[400px] w-[400px] rounded-full bg-fuchsia-700/[0.09] blur-[100px]" />
      </div>

      {/* Subtle perspective grid */}
      <div
        className="absolute inset-0 opacity-[0.018]"
        style={{
          backgroundImage:
            'linear-gradient(rgba(255,255,255,1) 1px,transparent 1px),' +
            'linear-gradient(90deg,rgba(255,255,255,1) 1px,transparent 1px)',
          backgroundSize: '72px 72px',
        }}
      />

      {/* Top-centre purple spotlight line */}
      <div className="absolute left-1/2 top-0 h-px w-[55%] -translate-x-1/2 bg-gradient-to-r from-transparent via-purple-500/25 to-transparent" />
      <div className="absolute left-1/2 top-0 h-64 w-[45%] -translate-x-1/2 rounded-full bg-purple-700/[0.08] blur-[80px]" />

      {/* Floating medical cross icons */}
      <span className="auth-float   absolute left-[6%]   top-[11%]  select-none text-5xl text-white/[0.03]">✚</span>
      <span className="auth-float-b absolute right-[7%]  bottom-[18%] select-none text-4xl text-white/[0.025]">✚</span>
      <span className="auth-float   absolute left-[4%]   top-[64%]  select-none text-3xl text-white/[0.02]">✚</span>
      <span className="auth-float-b absolute right-[11%] top-[20%]  select-none text-2xl text-white/[0.02]">✚</span>
    </div>
  )
}
