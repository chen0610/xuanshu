import React, { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'

interface Point {
  x: number
  y: number
  vx: number
  vy: number
}

export const NeuralBot = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  // 使用 useRef 存储鼠标位置，避免触发重新渲染和动画循环重建
  const mousePosRef = useRef({ x: 0, y: 0 })
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 }) // 仅用于眼睛跟踪
  const isVisibleRef = useRef(true)
  const animationFrameIdRef = useRef<number | null>(null)

  // --- Neural Network Background Logic ---
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let points: Point[] = []
    const pointCount = 60
    const connectionDistance = 150
    const mouseDistance = 200

    const resize = () => {
      if (containerRef.current && canvas) {
        canvas.width = containerRef.current.offsetWidth
        canvas.height = containerRef.current.offsetHeight
        initPoints()
      }
    }

    const initPoints = () => {
      points = []
      if (!canvas) return
      for (let i = 0; i < pointCount; i++) {
        points.push({
          x: Math.random() * canvas.width,
          y: Math.random() * canvas.height,
          vx: (Math.random() - 0.5) * 1, // Velocity
          vy: (Math.random() - 0.5) * 1
        })
      }
    }

    const draw = () => {
      if (!canvas || !ctx || !isVisibleRef.current) {
        animationFrameIdRef.current = null
        return
      }

      ctx.clearRect(0, 0, canvas.width, canvas.height)

      // 使用 ref 获取最新的鼠标位置，避免闭包问题
      const currentMousePos = mousePosRef.current

      // Update and draw points
      points.forEach((point, i) => {
        // Move
        point.x += point.vx
        point.y += point.vy

        // Bounce off walls
        if (point.x < 0 || point.x > canvas.width) point.vx *= -1
        if (point.y < 0 || point.y > canvas.height) point.vy *= -1

        // Mouse interaction (repel)
        const dx = point.x - currentMousePos.x
        const dy = point.y - currentMousePos.y
        const dist = Math.sqrt(dx * dx + dy * dy)

        if (dist < mouseDistance) {
          const angle = Math.atan2(dy, dx)
          const force = (mouseDistance - dist) / mouseDistance
          point.x += Math.cos(angle) * force * 2
          point.y += Math.sin(angle) * force * 2
        }

        // Draw point
        ctx.beginPath()
        ctx.arc(point.x, point.y, 2, 0, Math.PI * 2)
        ctx.fillStyle = 'rgba(100, 116, 139, 0.5)' // slate-500
        ctx.fill()

        // Draw connections
        for (let j = i + 1; j < points.length; j++) {
          const p2 = points[j]
          const dx2 = point.x - p2.x
          const dy2 = point.y - p2.y
          const dist2 = Math.sqrt(dx2 * dx2 + dy2 * dy2)

          if (dist2 < connectionDistance) {
            ctx.beginPath()
            ctx.moveTo(point.x, point.y)
            ctx.lineTo(p2.x, p2.y)
            ctx.strokeStyle = `rgba(100, 116, 139, ${0.2 * (1 - dist2 / connectionDistance)})`
            ctx.stroke()
          }
        }
      })

      animationFrameIdRef.current = requestAnimationFrame(draw)
    }

    // 使用 IntersectionObserver 检测组件可见性
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          isVisibleRef.current = entry.isIntersecting
          if (entry.isIntersecting && !animationFrameIdRef.current) {
            // 组件变为可见时，重新启动动画
            draw()
          }
        })
      },
      { threshold: 0.1 }
    )

    if (containerRef.current) {
      observer.observe(containerRef.current)
    }

    window.addEventListener('resize', resize)
    resize()

    // 只在组件可见时启动动画
    if (isVisibleRef.current) {
      draw()
    }

    return () => {
      window.removeEventListener('resize', resize)
      observer.disconnect()
      if (animationFrameIdRef.current !== null) {
        cancelAnimationFrame(animationFrameIdRef.current)
        animationFrameIdRef.current = null
      }
    }
  }, []) // 移除 mousePos 依赖，避免频繁重建动画循环

  // Track mouse for both canvas and eyes
  const handleMouseMove = (e: React.MouseEvent): void => {
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect()
      const newPos = {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
      }
      // 更新 ref（用于动画）
      mousePosRef.current = newPos
      // 更新 state（仅用于眼睛跟踪，使用节流减少更新频率）
      setMousePos(newPos)
    }
  }

  // --- Eye Tracking Logic ---
  // 使用 useMemo 优化眼睛位置计算，减少不必要的重新渲染
  const eyeOffset = React.useMemo(() => {
    if (!containerRef.current) return { left: { x: 0, y: 0 }, right: { x: 0, y: 0 } }
    const centerX = containerRef.current.offsetWidth / 2
    const centerY = containerRef.current.offsetHeight / 2

    const dx = mousePos.x - centerX
    const dy = mousePos.y - centerY
    const maxOffset = 6 // Max pixels eye can move

    const angle = Math.atan2(dy, dx)
    const dist = Math.min(Math.sqrt(dx * dx + dy * dy), 500) // Cap distance influence
    const power = dist / 500 // 0 to 1

    const offset = {
      x: Math.cos(angle) * maxOffset * power,
      y: Math.sin(angle) * maxOffset * power
    }

    return {
      left: offset,
      right: offset
    }
  }, [mousePos.x, mousePos.y])

  const leftEye = eyeOffset.left
  const rightEye = eyeOffset.right

  return (
    <div
      ref={containerRef}
      className="relative h-[520px] w-full overflow-hidden bg-[radial-gradient(circle_at_top,rgba(59,130,246,0.08),transparent_38%),linear-gradient(180deg,rgba(15,23,42,0.04),transparent)] sm:h-[600px]"
      onMouseMove={handleMouseMove}
    >
      {/* 1. Neural Network Background */}
      <canvas ref={canvasRef} className="absolute top-0 left-0 z-0 w-full h-full" />

      {/* 2. Floating Bot */}
      <div className="pointer-events-none absolute left-1/2 top-1/2 z-10 -translate-x-1/2 -translate-y-1/2 transform">
        <motion.div
          animate={{
            y: [0, -20, 0]
          }}
          transition={{
            duration: 4,
            repeat: Infinity,
            ease: 'easeInOut'
          }}
        >
          {/* Robot SVG */}
          <svg
            width="200"
            height="200"
            viewBox="0 0 200 200"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            {/* Antenna */}
            <motion.path
              d="M100 50V30"
              stroke="currentColor"
              strokeWidth="4"
              className="text-slate-500 dark:text-slate-300"
              animate={{ rotate: [0, 10, 0, -10, 0] }}
              transition={{ duration: 2, repeat: Infinity, delay: 1 }}
              style={{ originX: '50%', originY: '100%' }} // Pivot at bottom
            />
            <motion.circle
              cx="100"
              cy="25"
              r="5"
              className="fill-primary"
              animate={{ opacity: [0.5, 1, 0.5] }}
              transition={{ duration: 1.5, repeat: Infinity }}
            />

            {/* Body Shape (Rounded Rect) */}
            <rect
              x="50"
              y="50"
              width="100"
              height="80"
              rx="20"
              className="stroke-2 fill-card stroke-border"
            />

            {/* Screen/Face Area */}
            <rect x="60" y="65" width="80" height="50" rx="10" className="fill-slate-950" />

            {/* Eyes Group */}
            <g transform="translate(100, 90)">
              {/* Left Eye */}
              <circle cx="-20" cy="0" r="12" className="fill-slate-800" />
              <motion.circle cx={-20 + leftEye.x} cy={leftEye.y} r="6" className="fill-cyan-400" />

              {/* Right Eye */}
              <circle cx="20" cy="0" r="12" className="fill-slate-800" />
              <motion.circle cx={20 + rightEye.x} cy={rightEye.y} r="6" className="fill-cyan-400" />
            </g>

            {/* Mouth (if desired, or just keep it minimal) */}

            {/* Hover Arms - Simple floating circles or paths */}
            <motion.circle
              cx="40"
              cy="100"
              r="10"
              className="fill-slate-400"
              animate={{ y: [0, 5, 0] }}
              transition={{ duration: 2, repeat: Infinity, delay: 0.5 }}
            />
            <motion.circle
              cx="160"
              cy="100"
              r="10"
              className="fill-slate-400"
              animate={{ y: [0, -5, 0] }}
              transition={{ duration: 2, repeat: Infinity, delay: 0.5 }}
            />
          </svg>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="mt-6 text-center"
        >
          <p className="text-base font-medium text-foreground">系统待机中</p>
          <p className="mt-1 text-sm text-muted-foreground">正在监听投放信号与任务流</p>
        </motion.div>
      </div>

      <div className="absolute inset-x-0 top-0 flex items-center justify-between border-b border-border/70 px-5 py-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
            Signal Matrix
          </p>
          <p className="mt-1 text-sm text-foreground">运营网络状态可视化</p>
        </div>
        <div className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-400">
          Live
        </div>
      </div>
    </div>
  )
}
