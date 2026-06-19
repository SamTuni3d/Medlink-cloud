'use client'

import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'

// ── Rules ────────────────────────────────────────────────────────────────────
// • Framer-motion: whileHover / whileTap ONLY — never initial={{ opacity:0 }}
// • Entrance animations: CSS keyframes via className / style (safe in React 19)

// ── Stagger grid / items ─────────────────────────────────────────────────────

export function StaggerGrid({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return <div className={className}>{children}</div>
}

export function StaggerItem({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <div className={`stagger-item ${className ?? ''}`}>
      {children}
    </div>
  )
}

// ── Hover-lift card ──────────────────────────────────────────────────────────

export function HoverCard({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <motion.div
      whileHover={{ y: -4, boxShadow: '0 16px 40px -8px rgba(0,71,65,0.18)' }}
      whileTap={{ scale: 0.985 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
      className={className}
    >
      {children}
    </motion.div>
  )
}

// ── Pressable div ────────────────────────────────────────────────────────────

export function PressDiv({
  children,
  className,
  onClick,
}: {
  children: React.ReactNode
  className?: string
  onClick?: () => void
}) {
  return (
    <motion.div
      whileHover={{ scale: 1.015 }}
      whileTap={{ scale: 0.97 }}
      transition={{ duration: 0.15 }}
      className={className}
      onClick={onClick}
    >
      {children}
    </motion.div>
  )
}

// ── Slide-in row (table rows) ────────────────────────────────────────────────

export function SlideInRow({ children }: { children: React.ReactNode }) {
  return <tr className="stagger-item">{children}</tr>
}

// ── Fade-up (CSS, not framer-motion) ────────────────────────────────────────

export function FadeUp({
  children,
  delay = 0,
  className,
}: {
  children: React.ReactNode
  delay?: number
  className?: string
}) {
  return (
    <div
      className={`stagger-item ${className ?? ''}`}
      style={{ animationDelay: `${delay}s` }}
    >
      {children}
    </div>
  )
}

// ── FadeIn ───────────────────────────────────────────────────────────────────

export function FadeIn({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <div
      className={className}
      style={{ animation: 'fadeInOverlay 0.3s ease both' }}
    >
      {children}
    </div>
  )
}

// ── CountUp — animates a number from 0 to target ────────────────────────────

export function CountUp({
  to,
  duration = 1200,
  format,
  className,
}: {
  to: number
  duration?: number
  format?: (n: number) => string
  className?: string
}) {
  const [value, setValue] = useState(0)
  const rafRef = useRef<number | null>(null)
  const startRef = useRef<number | null>(null)

  useEffect(() => {
    startRef.current = null
    const animate = (ts: number) => {
      if (!startRef.current) startRef.current = ts
      const elapsed = ts - startRef.current
      const progress = Math.min(elapsed / duration, 1)
      // ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3)
      setValue(Math.round(eased * to))
      if (progress < 1) rafRef.current = requestAnimationFrame(animate)
    }
    rafRef.current = requestAnimationFrame(animate)
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current) }
  }, [to, duration])

  return (
    <span className={className}>
      {format ? format(value) : value.toLocaleString()}
    </span>
  )
}

// ── Ripple button ────────────────────────────────────────────────────────────

export function RippleButton({
  children,
  onClick,
  className,
  disabled,
}: {
  children: React.ReactNode
  onClick?: () => void
  className?: string
  disabled?: boolean
}) {
  const ref = useRef<HTMLButtonElement>(null)

  function handleClick(e: React.MouseEvent<HTMLButtonElement>) {
    if (disabled) return
    const btn = ref.current
    if (!btn) return
    const rect = btn.getBoundingClientRect()
    const size = Math.max(rect.width, rect.height)
    const x = e.clientX - rect.left - size / 2
    const y = e.clientY - rect.top - size / 2
    const circle = document.createElement('span')
    circle.className = 'ripple-circle'
    circle.style.cssText = `width:${size}px;height:${size}px;left:${x}px;top:${y}px`
    btn.appendChild(circle)
    circle.addEventListener('animationend', () => circle.remove())
    onClick?.()
  }

  return (
    <motion.button
      ref={ref}
      whileTap={{ scale: 0.97 }}
      transition={{ duration: 0.12 }}
      onClick={handleClick}
      disabled={disabled}
      className={`ripple-btn ${className ?? ''}`}
    >
      {children}
    </motion.button>
  )
}

// ── Magnetic nav item (subtle follow-cursor on hover) ───────────────────────

export function MagneticItem({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <motion.div
      whileHover={{ x: 3 }}
      whileTap={{ scale: 0.97 }}
      transition={{ duration: 0.18, ease: 'easeOut' }}
      className={className}
    >
      {children}
    </motion.div>
  )
}

// ── Pulse ring (notification / status indicator) ─────────────────────────────

export function PulseRing({
  color = '#004741',
  size = 8,
}: {
  color?: string
  size?: number
}) {
  return (
    <span className="relative inline-flex" style={{ width: size, height: size }}>
      <span
        className="absolute inline-flex h-full w-full rounded-full opacity-75"
        style={{
          background: color,
          animation: 'badge-pulse 1.6s cubic-bezier(0.4,0,0.6,1) infinite',
        }}
      />
      <span
        className="relative inline-flex rounded-full"
        style={{ width: size, height: size, background: color }}
      />
    </span>
  )
}
