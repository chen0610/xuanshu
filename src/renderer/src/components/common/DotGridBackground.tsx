import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { cn } from '../../lib/utils'

interface DotGridBackgroundProps {
  dotColor?: string
  dotSize?: number
  gridSize?: number
  speed?: number
  direction?: 'horizontal' | 'vertical' | 'both' | 'diagonal' | 'radial'
  pulse?: boolean
  className?: string
}

export const DotGridBackground = ({
  dotColor = 'rgba(156, 163, 175, 0.15)',
  dotSize = 2,
  gridSize = 40,
  speed = 1,
  direction = 'both',
  pulse = false,
  className
}: DotGridBackgroundProps) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 })
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

  // 计算需要的点数量
  const cols = Math.ceil(dimensions.width / gridSize) + 2
  const rows = Math.ceil(dimensions.height / gridSize) + 2
  const totalDots = cols * rows

  // 获取动画变体
  const getAnimationVariant = () => {
    const baseDuration = 20 / speed

    if (pulse) {
      return {
        opacity: [0.3, 0.6, 0.3],
        scale: [1, 1.05, 1],
        transition: {
          duration: baseDuration,
          repeat: Infinity,
          ease: 'easeInOut'
        }
      }
    }

    switch (direction) {
      case 'horizontal':
        return {
          y: [0, -gridSize],
          transition: {
            duration: baseDuration,
            repeat: Infinity,
            ease: 'linear'
          }
        }
      case 'vertical':
        return {
          x: [0, -gridSize],
          transition: {
            duration: baseDuration,
            repeat: Infinity,
            ease: 'linear'
          }
        }
      case 'diagonal':
        return {
          x: [0, -gridSize],
          y: [0, -gridSize],
          transition: {
            duration: baseDuration,
            repeat: Infinity,
            ease: 'linear'
          }
        }
      case 'radial':
        return {
          scale: [1, 1.1, 1],
          opacity: [0.5, 0.8, 0.5],
          transition: {
            duration: baseDuration,
            repeat: Infinity,
            ease: 'easeInOut'
          }
        }
      case 'both':
      default:
        return {
          x: [0, -gridSize],
          y: [0, -gridSize],
          transition: {
            duration: baseDuration,
            repeat: Infinity,
            ease: 'linear'
          }
        }
    }
  }

  // 渲染点阵层
  const renderDotLayer = (offsetX = 0, offsetY = 0, key: string) => {
    return (
      <div
        key={key}
        className="absolute"
        style={{
          left: offsetX,
          top: offsetY,
          width: cols * gridSize,
          height: rows * gridSize
        }}
      >
        {Array.from({ length: totalDots }).map((_, index) => {
          const row = Math.floor(index / cols)
          const col = index % cols

          return (
            <motion.div
              key={`${key}-${index}`}
              className="absolute rounded-full"
              style={{
                left: col * gridSize,
                top: row * gridSize,
                width: dotSize,
                height: dotSize,
                backgroundColor: dotColor
              }}
              animate={
                direction === 'radial'
                  ? {
                      scale: [1, 1 + Math.sin((row + col) * 0.5) * 0.3, 1],
                      opacity: [0.5, 0.8 + Math.cos((row + col) * 0.3) * 0.2, 0.5]
                    }
                  : {}
              }
              transition={
                direction === 'radial'
                  ? {
                      duration: 2 + (row + col) * 0.1,
                      repeat: Infinity,
                      ease: 'easeInOut',
                      delay: (row + col) * 0.05
                    }
                  : {}
              }
            />
          )
        })}
      </div>
    )
  }

  return (
    <div ref={containerRef} className={cn('overflow-hidden absolute inset-0', className)}>
      <motion.div
        ref={motionRef}
        className="relative"
        style={{
          width: cols * gridSize * 2,
          height: rows * gridSize * 2
        }}
        animate={isVisible ? getAnimationVariant() : {}}
      >
        {/* 主点阵层 */}
        {renderDotLayer(0, 0, 'main')}
        {/* 无缝循环的辅助点阵层 */}
        {direction === 'horizontal' && renderDotLayer(0, rows * gridSize, 'h')}
        {direction === 'vertical' && renderDotLayer(cols * gridSize, 0, 'v')}
        {(direction === 'both' || direction === 'diagonal') && (
          <>
            {renderDotLayer(cols * gridSize, 0, 'v1')}
            {renderDotLayer(0, rows * gridSize, 'h1')}
            {renderDotLayer(cols * gridSize, rows * gridSize, 'd1')}
          </>
        )}
      </motion.div>
    </div>
  )
}
