import { useState, useEffect } from 'react'
import '../css/Leaderboard.css'
import { getAllPlayerProfiles } from '../services/contract'

interface LeaderboardPlayer {
  rank: number
  name: string
  wallet: string
  wins: number
  losses: number
  trophies: number
}

function Leaderboard() {
  const [players, setPlayers] = useState<LeaderboardPlayer[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'trophy' | 'wins'>('trophy')

  useEffect(() => {
    loadLeaderboard()
  }, [])

  const loadLeaderboard = async () => {
    setLoading(true)
    try {
      const profiles = await getAllPlayerProfiles()
      const leaderboardData: LeaderboardPlayer[] = profiles.map((p, index) => ({
        rank: index + 1,
        name: p.username || 'Unknown',
        wallet: p.wallet.toBase58().slice(0, 4) + '...' + p.wallet.toBase58().slice(-4),
        wins: p.totalWins,
        losses: p.totalLosses,
        trophies: p.trophies,
      }))
      setPlayers(leaderboardData)
    } catch (error) {
      console.error('Failed to load leaderboard:', error)
    } finally {
      setLoading(false)
    }
  }

  const getSortedPlayers = () => {
    if (activeTab === 'wins') {
      return [...players].sort((a, b) => b.wins - a.wins).map((p, i) => ({ ...p, rank: i + 1 }))
    }
    return players // Already sorted by trophies
  }

  const getRankClass = (rank: number) => {
    if (rank === 1) return 'rank-top-1'
    if (rank === 2) return 'rank-top-2'
    if (rank === 3) return 'rank-top-3'
    return ''
  }

  const getRankDisplay = (rank: number) => {
    return `#${rank.toString().padStart(2, '0')}`
  }

  const sortedPlayers = getSortedPlayers()

  return (
    <div className="leaderboard-container">
      <div className="leaderboard-title">RANK_SYSTEM // TOP_PLAYERS</div>

      <div className="leaderboard-tabs-cyber">
        <button 
          className={`tab-cyber ${activeTab === 'trophy' ? 'active' : ''}`}
          onClick={() => setActiveTab('trophy')}
        >
          TROPHY_RANK
        </button>
        <button 
          className={`tab-cyber ${activeTab === 'wins' ? 'active' : ''}`}
          onClick={() => setActiveTab('wins')}
        >
          WIN_RANK
        </button>
        <button className="tab-cyber" onClick={loadLeaderboard}>
          REFRESH
        </button>
      </div>

      {loading ? (
        <div className="leaderboard-loading">Loading...</div>
      ) : sortedPlayers.length === 0 ? (
        <div className="leaderboard-empty">No players found</div>
      ) : (
        <div className="leaderboard-list-cyber">
          {sortedPlayers.map(player => (
            <div key={player.wallet} className={`leaderboard-row ${getRankClass(player.rank)}`}>
              <div className="rank-number">{getRankDisplay(player.rank)}</div>
              <div className="player-data">
                <div className="player-name-cyber">{player.name}</div>
                <div className="player-wallet-cyber">{player.wallet}</div>
              </div>
              <div className="player-stats-cyber">
                <div className="stat-item">
                  <span className="stat-label-cyber">WINS:</span>
                  <span className="stat-value-cyber">{player.wins}</span>
                </div>
                <div className="stat-item">
                  <span className="stat-label-cyber">🏆:</span>
                  <span className="stat-value-cyber score-highlight">{player.trophies}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default Leaderboard
