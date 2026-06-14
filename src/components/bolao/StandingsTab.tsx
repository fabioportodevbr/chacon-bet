'use client'

import { useEffect, useState } from 'react'
import { translateTeam } from '@/lib/teams-pt'
import { TeamFlag } from './TeamFlag'

type StandingRow = {
  position: number
  team: string
  playedGames: number
  won: number
  draw: number
  lost: number
  points: number
  goalsFor: number
  goalsAgainst: number
  goalDifference: number
}

type Group = {
  group: string
  table: StandingRow[]
}

const th: React.CSSProperties = {
  fontSize: 10,
  fontWeight: 700,
  color: '#9CA3AF',
  textAlign: 'center',
  padding: '5px 4px',
  letterSpacing: '0.05em',
  whiteSpace: 'nowrap',
}

const td = (highlight: boolean, bold = false): React.CSSProperties => ({
  fontSize: 12,
  color: highlight ? '#1D3A28' : '#3D3530',
  fontWeight: bold ? 700 : 400,
  textAlign: 'center',
  padding: '6px 4px',
  borderTop: '1px solid #F0EDE8',
})

export default function StandingsTab() {
  const [groups, setGroups] = useState<Group[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/standings')
      .then(r => r.json())
      .then(d => {
        if (d.error) throw new Error(d.error)
        setGroups(d.groups ?? [])
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return (
    <div style={{ textAlign: 'center', padding: '48px 0', color: '#9CA3AF', fontSize: 13 }}>
      Carregando tabelas...
    </div>
  )

  if (error) return (
    <div style={{ textAlign: 'center', padding: '48px 0', color: '#B91C1C', fontSize: 13 }}>
      Erro ao carregar: {error}
    </div>
  )

  if (!groups.length) return (
    <div style={{ textAlign: 'center', padding: '48px 0', color: '#9CA3AF', fontSize: 13 }}>
      Tabelas ainda não disponíveis.
    </div>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {groups.map(({ group, table }) => (
        <div key={group} style={{ background: '#fff', border: '0.5px solid rgba(0,0,0,0.07)' }}>

          {/* Header do grupo */}
          <div style={{ background: '#1D3A28', padding: '6px 12px', display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ color: '#B8962E', fontSize: 11, fontWeight: 700, letterSpacing: '0.08em' }}>
              GRUPO {group}
            </span>
          </div>

          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#FAFAF8' }}>
                <th style={{ ...th, textAlign: 'left', paddingLeft: 10, width: 24 }}>#</th>
                <th style={{ ...th, textAlign: 'left', paddingLeft: 4 }}>Time</th>
                <th style={th}>J</th>
                <th style={th}>V</th>
                <th style={th}>E</th>
                <th style={th}>D</th>
                <th style={th}>GP</th>
                <th style={th}>GC</th>
                <th style={th}>SG</th>
                <th style={{ ...th, color: '#1D3A28' }}>PTS</th>
              </tr>
            </thead>
            <tbody>
              {table.map((row) => {
                const qualifies = row.position <= 2
                const rowBg = qualifies ? '#F0F4F1' : '#fff'
                return (
                  <tr key={row.team} style={{ background: rowBg }}>
                    <td style={{ ...td(qualifies, qualifies), paddingLeft: 10, borderLeft: qualifies ? '3px solid #2D6A4F' : '3px solid transparent' }}>
                      {row.position}
                    </td>
                    <td style={{ ...td(qualifies), textAlign: 'left', paddingLeft: 4 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                        <TeamFlag team={row.team} size={16} inline />
                        <span style={{ fontWeight: qualifies ? 600 : 400, fontSize: 12, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 100 }}>
                          {translateTeam(row.team)}
                        </span>
                      </div>
                    </td>
                    <td style={td(qualifies)}>{row.playedGames}</td>
                    <td style={td(qualifies)}>{row.won}</td>
                    <td style={td(qualifies)}>{row.draw}</td>
                    <td style={td(qualifies)}>{row.lost}</td>
                    <td style={td(qualifies)}>{row.goalsFor}</td>
                    <td style={td(qualifies)}>{row.goalsAgainst}</td>
                    <td style={td(qualifies)}>{row.goalDifference > 0 ? `+${row.goalDifference}` : row.goalDifference}</td>
                    <td style={{ ...td(qualifies, true), color: '#1D3A28' }}>{row.points}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>

          {/* Legenda */}
          <div style={{ padding: '5px 10px 7px', display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ width: 8, height: 8, background: '#2D6A4F', borderRadius: 1 }} />
            <span style={{ fontSize: 10, color: '#78716C' }}>Classificado para as oitavas</span>
          </div>
        </div>
      ))}
    </div>
  )
}
