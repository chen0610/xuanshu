import React, { type ReactNode } from 'react'
import { motion } from 'framer-motion'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui'

interface PAssistantFeaturePanelProps {
  title: string
  description: ReactNode
  icon: ReactNode
  children: ReactNode
  danger?: boolean
  contentClassName?: string
}

export const PAssistantFeaturePanel: React.FC<PAssistantFeaturePanelProps> = ({
  title,
  description,
  icon,
  children,
  danger = false,
  contentClassName = 'space-y-4'
}) => {
  const iconColorClass = danger ? 'text-destructive' : 'text-primary'
  const iconBgClass = danger ? 'bg-destructive/10' : 'bg-primary/10'
  const titleClassName = danger
    ? 'flex items-center gap-2 text-destructive'
    : 'flex items-center gap-2'
  const cardClassName = danger
    ? 'border-2 border-destructive/20 bg-gradient-to-br from-card to-card/50 backdrop-blur-sm'
    : 'border-2 bg-gradient-to-br from-card to-card/50 backdrop-blur-sm'

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="space-y-4"
    >
      <Card className={cardClassName}>
        <CardHeader>
          <CardTitle className={titleClassName}>
            <div className={`p-1.5 rounded-md ${iconBgClass}`}>
              <span className={`[&>svg]:w-4 [&>svg]:h-4 ${iconColorClass}`}>{icon}</span>
            </div>
            {title}
          </CardTitle>
          <CardDescription className={danger ? 'text-destructive' : undefined}>
            {description}
          </CardDescription>
        </CardHeader>
        <CardContent className={contentClassName}>{children}</CardContent>
      </Card>
    </motion.div>
  )
}
