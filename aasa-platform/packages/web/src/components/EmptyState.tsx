import { Button } from './ui/button'

interface EmptyStateProps {
  icon?: React.ReactNode
  title: string
  description: string
  action?: {
    label: string
    onClick: () => void
  }
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
      {icon && (
        <div className="mb-4 text-muted-foreground/60">{icon}</div>
      )}

      <h3 className="text-lg font-semibold text-foreground mb-1.5">{title}</h3>

      <p className="text-sm text-muted-foreground max-w-sm leading-relaxed mb-6">{description}</p>

      {action && (
        <Button onClick={action.onClick} variant="default" className="min-h-[44px]">
          {action.label}
        </Button>
      )}
    </div>
  )
}
