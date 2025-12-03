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

function Leaderboard({ onBack }: LeaderboardProps) {
  const getRankClass = (rank: number) => {
    if (rank === 1) return 'top-1'
    if (rank === 2) return 'top-2'
    if (rank === 3) return 'top-3'
    return ''
  }

  const getRankDisplay = (rank: number) => {
    if (rank === 1) return '🥇'
    if (rank === 2) return '🥈'
    if (rank === 3) return '🥉'
    return rank
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <span className="icon">🏆</span>
        <h2>排行榜</h2>
        <button className="back-btn" onClick={onBack}>返回</button>
      </div>

      <div className="leaderboard-tabs">
        <button className="tab-btn active">积分榜</button>
        <button className="tab-btn">胜场榜</button>
        <button className="tab-btn">收藏榜</button>
      </div>

      <div className="leaderboard-list">
        {mockPlayers.map(player => (
          <div key={player.rank} className={`leaderboard-item ${getRankClass(player.rank)}`}>
            <div className="rank">{getRankDisplay(player.rank)}</div>
            <div className="player-avatar">🦊</div>
            <div className="player-info">
              <span className="player-name">{player.name}</span>
              <span className="player-wallet">{player.wallet}</span>
            </div>
            <div className="player-stats">
              <div className="stat">
                <span className="stat-value">{player.wins}</span>
                <span className="stat-label">胜场</span>
              </div>
            </div>
            <div className="player-score">{player.score}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default Leaderboard
