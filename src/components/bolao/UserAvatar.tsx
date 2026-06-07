/* eslint-disable @next/next/no-img-element */
interface Props {
  avatarUrl?: string | null
  name: string
  frase?: string | null
  size?: 'xs' | 'sm' | 'md' | 'lg'
  showFrase?: boolean
  className?: string
}

const sizeClasses: Record<string, { wrap: string; text: string }> = {
  xs: { wrap: 'w-7 h-7 text-xs', text: '' },
  sm: { wrap: 'w-9 h-9 text-sm', text: '' },
  md: { wrap: 'w-12 h-12 text-base', text: '' },
  lg: { wrap: 'w-16 h-16 text-xl', text: '' },
}

function initials(name: string) {
  return name
    .split(' ')
    .filter(Boolean)
    .map(n => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
}

export default function UserAvatar({
  avatarUrl,
  name,
  frase,
  size = 'sm',
  showFrase = false,
  className = '',
}: Props) {
  const { wrap } = sizeClasses[size]
  const isPhoto = !!avatarUrl?.startsWith('http')

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      {isPhoto ? (
        <img
          src={avatarUrl!}
          alt={name}
          className={`${wrap} rounded-full object-cover shrink-0 border-2 border-white shadow-sm`}
        />
      ) : (
        <div className={`${wrap} rounded-full bg-green-600 flex items-center justify-center text-white font-bold shrink-0 border-2 border-white shadow-sm`}>
          {initials(name)}
        </div>
      )}
      <div className="min-w-0">
        <p className="font-semibold text-gray-900 leading-tight truncate">{name}</p>
        {showFrase && frase && (
          <p className="text-xs text-gray-400 italic leading-tight truncate">{frase}</p>
        )}
      </div>
    </div>
  )
}
