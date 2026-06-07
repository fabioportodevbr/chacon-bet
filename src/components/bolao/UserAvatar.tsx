interface Props {
  avatar?: string | null
  name: string
  frase?: string | null
  size?: 'xs' | 'sm' | 'md' | 'lg'
  showFrase?: boolean
  className?: string
}

const emojiSizes: Record<string, string> = {
  xs: 'text-lg',
  sm: 'text-2xl',
  md: 'text-3xl',
  lg: 'text-5xl',
}

export default function UserAvatar({
  avatar,
  name,
  frase,
  size = 'sm',
  showFrase = false,
  className = '',
}: Props) {
  const emoji = avatar || '👤'

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <span className={`${emojiSizes[size]} leading-none select-none shrink-0`}>{emoji}</span>
      <div className="min-w-0">
        <p className="font-semibold text-gray-900 leading-tight truncate">{name}</p>
        {showFrase && frase && (
          <p className="text-xs text-gray-400 italic leading-tight truncate">{frase}</p>
        )}
      </div>
    </div>
  )
}
