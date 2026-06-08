import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { cn } from '../../lib/utils'

interface SquaresBackgroundProps {
  direction?: 'right' | 'left' | 'up' | 'down' | 'diagonal'
  speed?: number
  squareSize?: number
  borderColor?: string
  hoverFillColor?: string
  className?: string
}

export const SquaresBackground = ({
  direction = 'right',
  speed = 1.2,
  squareSize = 40,
  borderColor = 'rgba(156, 163, 175, 0.3)',
  hoverFillColor = 'rgba(34, 34, 34, 0.1)',
  className
}: SquaresBackgroundProps) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 })
  const [hoveredSquare, setHoveredSquare] = useState<string | null>(null)
  const [isVisible, setIsVisible] = useState(true)
  const motionRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        setDimensions({
          width: containerRef.current.offsetWidth,
          height: containerRef.current.offsetHeight
        })
      }
    }

    updateDimensions()
    window.addEventListener('resize', updateDimensions)

    // 使用 IntersectionObserver 检测组件可见性
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          setIsVisible(entry.isIntersecting)
        })
      },
      { threshold: 0.1 }
    )

    if (containerRef.current) {
      observer.observe(containerRef.current)
    }

    return () => {
      window.removeEventListener('resize', updateDimensions)
      observer.disconnect()
    }
  }, [])

  // 计算需要的行数和列数
  const cols = Math.ceil(dimensions.width / squareSize) + 2
  const rows = Math.ceil(dimensions.height / squareSize) + 2
  const totalSquares = cols * rows

  // 根据方向计算动画变体
  const getAnimationVariant = () => {
    const baseDuration = 10 / speed // 速度越快，持续时间越短

    switch (direction) {
      case 'right':
        return {
          x: [0, squareSize],
          transition: {
            duration: baseDuration,
            repeat: Infinity,
            ease: 'linear'
          }
        }
      case 'left':
        return {
          x: [0, -squareSize],
          transition: {
            duration: baseDuration,
            repeat: Infinity,
            ease: 'linear'
          }
        }
      case 'up':
        return {
          y: [0, squareSize],
          transition: {
            duration: baseDuration,
            repeat: Infinity,
            ease: 'linear'
          }
        }
      case 'down':
        return {
          y: [0, -squareSize],
          transition: {
            duration: baseDuration,
            repeat: Infinity,
            ease: 'linear'
          }
        }
      case 'diagonal':
        return {
          x: [0, squareSize],
          y: [0, squareSize],
          transition: {
            duration: baseDuration,
            repeat: Infinity,
            ease: 'linear'
          }
        }
      default:
        return {}
    }
  }

  // 渲染单个网格
  const renderGrid = (offsetX = 0, offsetY = 0) => (
    <div
      className="absolute"
      style={{
        left: offsetX,
        top: offsetY,
        width: cols * squareSize,
        height: rows * squareSize
      }}
    >
      {Array.from({ length: totalSquares }).map((_, index) => {
        const row = Math.floor(index / cols)
        const col = index % cols
        const squareId = `${offsetX}-${offsetY}-${index}`
        const isHovered = hoveredSquare === squareId

        return (
          <motion.div
            key={squareId}
            className="absolute border"
            style={{
              left: col * squareSize,
              top: row * squareSize,
              width: squareSize,
              height: squareSize,
              borderColor,
              backgroundColor: isHovered ? hoverFillColor : 'transparent'
            }}
            onMouseEnter={() => setHoveredSquare(squareId)}
            onMouseLeave={() => setHoveredSquare(null)}
            animate={{
              backgroundColor: isHovered ? hoverFillColor : 'transparent'
            }}
            transition={{ duration: 0.2 }}
          />
        )
      })}
    </div>
  )

  return (
    <div ref={containerRef} className={cn('overflow-hidden absolute inset-0', className)}>
      <motion.div
        ref={motionRef}
        className="relative"
        style={{
          width: cols * squareSize * 2,
          height: rows * squareSize * 2
        }}
        animate={isVisible ? getAnimationVariant() : {}}
      >
        {/* 主网格 */}
        {renderGrid(0, 0)}
        {/* 无缝循环的辅助网格 */}
        {direction === 'right' && renderGrid(cols * squareSize, 0)}
        {direction === 'left' && renderGrid(-cols * squareSize, 0)}
        {direction === 'up' && renderGrid(0, -rows * squareSize)}
        {direction === 'down' && renderGrid(0, rows * squareSize)}
        {direction === 'diagonal' && (
          <>
            {renderGrid(cols * squareSize, 0)}
            {renderGrid(0, rows * squareSize)}
            {renderGrid(cols * squareSize, rows * squareSize)}
          </>
        )}
      </motion.div>
    </div>
  )
}
