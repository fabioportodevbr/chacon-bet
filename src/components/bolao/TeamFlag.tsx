import { flagUrl } from '@/lib/flag-codes'

interface TeamFlagProps {
  team: string
  size?: number
  inline?: boolean
}

export function TeamFlag({ team, size = 32, inline = false }: TeamFlagProps) {
  const url = flagUrl(team)
  if (!url) return null
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={url}
      alt={team}
      width={size}
      height={size}
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        objectFit: 'cover',
        display: inline ? 'inline-block' : 'block',
        verticalAlign: inline ? 'middle' : undefined,
        flexShrink: 0,
      }}
    />
  )
}
