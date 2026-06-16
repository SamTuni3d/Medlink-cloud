'use client'

import { useEffect, useRef, useState } from 'react'
import { motion, useMotionValue, useSpring } from 'framer-motion'

export function CustomCursor() {
  const [visible, setVisible] = useState(false)
  const [clicking, setClicking] = useState(false)
  const [hovering, setHovering] = useState(false)
  const [isTouchDevice, setIsTouchDevice] = useState(false)

  const mx = useMotionValue(-200)
  const my = useMotionValue(-200)

  // Dot follows instantly
  const dotX = useSpring(mx, { stiffness: 1000, damping: 50 })
  const dotY = useSpring(my, { stiffness: 1000, damping: 50 })

  // Ring lags behind — the "rubber band" feel
  const ringX = useSpring(mx, { stiffness: 180, damping: 22 })
  const ringY = useSpring(my, { stiffness: 180, damping: 22 })

  useEffect(() => {
    if (typeof window === 'undefined') return
    if ('ontouchstart' in window || navigator.maxTouchPoints > 0) {
      setIsTouchDevice(true)
      return
    }

    const onMove = (e: MouseEvent) => {
      mx.set(e.clientX)
      my.set(e.clientY)
      setVisible(true)

      const el = e.target as Element
      const isClickable =
        el.closest('button, a, input, select, textarea, [role="button"], [tabindex], label') !== null ||
        window.getComputedStyle(el).cursor === 'pointer'
      setHovering(isClickable)
    }
    const onDown = () => setClicking(true)
    const onUp = () => setClicking(false)
    const onLeave = () => setVisible(false)
    const onEnter = () => setVisible(true)

    window.addEventListener('mousemove', onMove)
    window.addEventListener('mousedown', onDown)
    window.addEventListener('mouseup', onUp)
    document.addEventListener('mouseleave', onLeave)
    document.addEventListener('mouseenter', onEnter)

    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mousedown', onDown)
      window.removeEventListener('mouseup', onUp)
      document.removeEventListener('mouseleave', onLeave)
      document.removeEventListener('mouseenter', onEnter)
    }
  }, [mx, my])

  if (isTouchDevice) return null

  return (
    <>
      {/* Trailing glow ring */}
      <motion.div
        className="pointer-events-none fixed top-0 left-0 z-[9998] rounded-full border-2"
        style={{
          x: ringX,
          y: ringY,
          translateX: '-50%',
          translateY: '-50%',
        }}
        animate={{
          width: clicking ? 24 : hovering ? 48 : 38,
          height: clicking ? 24 : hovering ? 48 : 38,
          opacity: visible ? 1 : 0,
          borderColor: hovering
            ? 'hsl(143 80% 27% / 0.7)'
            : 'hsl(143 80% 27% / 0.35)',
          backgroundColor: clicking
            ? 'hsl(143 80% 27% / 0.12)'
            : hovering
              ? 'hsl(143 80% 27% / 0.06)'
              : 'transparent',
          scale: clicking ? 0.82 : 1,
        }}
        transition={{ duration: 0.15, ease: 'easeOut' }}
      />

      {/* Sharp center dot */}
      <motion.div
        className="pointer-events-none fixed top-0 left-0 z-[9999] rounded-full bg-primary"
        style={{
          x: dotX,
          y: dotY,
          translateX: '-50%',
          translateY: '-50%',
        }}
        animate={{
          width: clicking ? 5 : hovering ? 7 : 6,
          height: clicking ? 5 : hovering ? 7 : 6,
          opacity: visible ? 1 : 0,
          scale: clicking ? 0.6 : hovering ? 1.2 : 1,
        }}
        transition={{ duration: 0.1 }}
      />
    </>
  )
}
