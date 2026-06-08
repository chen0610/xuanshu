import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { cn } from '../../lib/utils'

interface GridMotionBackgroundProps {
  lineColor?: string
  lineWidth?: number
  gridSize?: number
  speed?: number
  direction?: 'horizontal' | 'vertical' | 'both' | 'diagonal'
  pulse?: boolean
  className?: string
}

export const GridMotionBackground = ({
  lineColor = 'rgba(156, 163, 175, 0.1)',
  lineWidth = 1,
  gridSize = 50,
  speed = 1,
  direction = 'both',
  pulse = false,
  className
}: GridMotionBackgroundProps) => {
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

  // 计算需要的线条数量
  const horizontalLines = Math.ceil(dimensions.height / gridSize) + 2
  const verticalLines = Math.ceil(dimensions.width / gridSize) + 2

  // 获取动画变体
  const getAnimationVariant = () => {
    const baseDuration = 20 / speed

    if (pulse) {
      return {
        opacity: [0.3, 0.6, 0.3],
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

  // 渲染网格层
  const renderGridLayer = (offsetX = 0, offsetY = 0, key: string) => {
    const totalWidth = dimensions.width + gridSize * 2
    const totalHeight = dimensions.height + gridSize * 2

    return (
      <svg
        key={key}
        className="absolute"
        style={{
          left: offsetX,
          top: offsetY,
          width: totalWidth,
          height: totalHeight
        }}
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <pattern
            id={`grid-pattern-${key}`}
            width={gridSize}
            height={gridSize}
            patternUnits="userSpaceOnUse"
          >
            <path
              d={`M ${gridSize} 0 L 0 0 0 ${gridSize}`}
              fill="none"
              stroke={lineColor}
              strokeWidth={lineWidth}
            />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill={`url(#grid-pattern-${key})`} />
      </svg>
    )
  }

  return (
    <div ref={containerRef} className={cn('overflow-hidden absolute inset-0', className)}>
      <motion.div
        ref={motionRef}
        className="relative"
        style={{
          width: dimensions.width + gridSize * 2,
          height: dimensions.height + gridSize * 2
        }}
        animate={isVisible ? getAnimationVariant() : {}}
      >
        {/* 主网格层 */}
        {renderGridLayer(0, 0, 'main')}
        {/* 无缝循环的辅助网格层 */}
        {direction === 'horizontal' && renderGridLayer(0, gridSize * horizontalLines, 'h')}
        {direction === 'vertical' && renderGridLayer(gridSize * verticalLines, 0, 'v')}
        {(direction === 'both' || direction === 'diagonal') && (
          <>
            {renderGridLayer(gridSize * verticalLines, 0, 'v1')}
            {renderGridLayer(0, gridSize * horizontalLines, 'h1')}
            {renderGridLayer(gridSize * verticalLines, gridSize * horizontalLines, 'd1')}
          </>
        )}
      </motion.div>
    </div>
  )
}
