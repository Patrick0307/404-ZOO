import '../css/Battle.css'

interface BattleProps {
  onBack: () => void
}

function Battle({ onBack }: BattleProps) {
  return (
    <div className="page-container">
      <div className="page-header">
        <span className="icon">⚔️</span>
        <h2>对战</h2>
        <button className="back-btn" onClick={onBack}>返回</button>
      </div>

      <div className="battle-content">
        <div className="battle-modes">
          <div className="battle-mode-card">
            <div className="mode-icon">🎯</div>
            <h3 className="mode-title">排位赛</h3>
            <p className="mode-desc">与其他玩家实时对战，提升排名</p>
            <div className="mode-reward">
              <span>奖励:</span>
              <span className="reward-value">💎 0.1-0.5 SOL</span>
            </div>
            <button className="mode-btn">开始匹配</button>
          </div>

          <div className="battle-mode-card">
            <div className="mode-icon">🏟️</div>
            <h3 className="mode-title">竞技场</h3>
            <p className="mode-desc">挑战AI对手，练习战斗技巧</p>
            <div className="mode-reward">
              <span>奖励:</span>
              <span className="reward-value">经验值 + 金币</span>
            </div>
            <button className="mode-btn secondary">进入</button>
          </div>

          <div className="battle-mode-card">
            <div className="mode-icon">👥</div>
            <h3 className="mode-title">好友对战</h3>
            <p className="mode-desc">邀请好友进行友谊赛</p>
            <div className="mode-reward">
              <span>奖励:</span>
              <span className="reward-value">无</span>
            </div>
            <button className="mode-btn secondary">创建房间</button>
          </div>
        </div>

        <div className="battle-stats">
          <h3>我的战绩</h3>
          <div className="stats-grid">
            <div className="stat-item">
              <span className="stat-value">15</span>
              <span className="stat-label">总场次</span>
            </div>
            <div className="stat-item">
              <span className="stat-value win">10</span>
              <span className="stat-label">胜利</span>
            </div>
            <div className="stat-item">
              <span className="stat-value lose">5</span>
              <span className="stat-label">失败</span>
            </div>
            <div className="stat-item">
              <span className="stat-value">67%</span>
              <span className="stat-label">胜率</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Battle
