import '../css/Leaderboard.css'

interface LeaderboardProps {
  onBack: () => void
}

const mockPlayers = [
  { rank: 1, name: 'DragonMaster', wallet: '0x7a...3f', wins: 156, score: 2850 },
  { rank: 2, name: 'PhoenixKing', wallet: '0x4b...9c', wins: 142, score: 2720 },
  { rank: 3, name: 'ShadowHunter', wallet: '0x2d...1e', wins: 138, score: 2680 },
  { rank: 4, name: 'IceQueen', wallet: '0x8f...7a', wins: 125, score: 2540 },
  { rank: 5, name: 'ThunderGod', wallet: '0x1c...5d', wins: 118, score: 2480 },
  { rank: 6, name: 'FireLord', wallet: '0x9e...2b', wins: 112, score: 2420 },
  { rank: 7, name: 'WindWalker', wallet: '0x3a...8f', wins: 105, score: 2350 },
  { rank: 8, name: 'EarthShaker', wallet: '0x6d...4c', wins: 98, score: 2280 },
]

function Leaderboard() {
  const getRankClass = (rank: number) => {
    if (rank === 1) return 'rank-top-1'
    if (rank === 2) return 'rank-top-2'
    if (rank === 3) return 'rank-top-3'
    return ''
  }

  const getRankDisplay = (rank: number) => {
    return `#${rank.toString().padStart(2, '0')}`
  }

  return (
    <div className="leaderboard-container">
      <div className="leaderboard-title">RANK_SYSTEM // TOP_PLAYERS</div>

      <div className="leaderboard-tabs-cyber">
        <button className="tab-cyber active">SCORE_RANK</button>
        <button className="tab-cyber">WIN_RANK</button>
        <button className="tab-cyber">COLLECTION_RANK</button>
      </div>

      <div className="leaderboard-list-cyber">
        {mockPlayers.map(player => (
          <div key={player.rank} className={`leaderboard-row ${getRankClass(player.rank)}`}>
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
                <span className="stat-label-cyber">SCORE:</span>
                <span className="stat-value-cyber score-highlight">{player.score}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default Leaderboard
