import { useState, useEffect } from 'react'
import '../css/Battle.css'
import {
  getPlayerDecks,
  type PlayerProfile,
  type PlayerDeck,
} from '../services/contract'

interface BattleProps {
  onBack: () => void
  playerProfile: PlayerProfile | null
}

function Battle({ onBack, playerProfile }: BattleProps) {
  const [savedDecks, setSavedDecks] = useState<PlayerDeck[]>([])
  const [selectedDeck, setSelectedDeck] = useState<PlayerDeck | null>(null)

  useEffect(() => {
    if (playerProfile) {
      loadSavedDecks()
    }
  }, [playerProfile])

  const loadSavedDecks = async () => {
    if (!playerProfile) return
    try {
      const decks = await getPlayerDecks(playerProfile.wallet)
      setSavedDecks(decks)
      if (decks.length > 0 && !selectedDeck) {
        setSelectedDeck(decks[0])
      }
    } catch (error) {
      console.error('Failed to load saved decks:', error)
    }
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <span className="icon">⚔️</span>
        <h2>对战</h2>
        <button className="back-btn" onClick={onBack}>返回</button>
      </div>

      <div className="battle-content">
        {/* 选择出战卡组 */}
        <div className="deck-select-section">
          <h3>🃏 选择出战卡组</h3>
          {savedDecks.length === 0 ? (
            <div className="no-deck-hint">
              还没有卡组，请先去「组队」页面创建卡组
            </div>
          ) : (
            <div className="deck-select-list">
              {savedDecks.map((deck) => (
                <div 
                  key={deck.deckIndex}
                  className={`deck-select-item ${selectedDeck?.deckIndex === deck.deckIndex ? 'selected' : ''}`}
                  onClick={() => setSelectedDeck(deck)}
                >
                  <span className="deck-select-name">{deck.deckName}</span>
                  <span className="deck-select-count">{deck.cardMints.length}张</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 对战模式 */}
        <div className="battle-modes">
          <div className="battle-mode-card">
            <div className="mode-icon">🎯</div>
            <h3 className="mode-title">排位赛</h3>
            <p className="mode-desc">与其他玩家实时对战，提升排名</p>
            <div className="mode-reward">
              <span>奖励:</span>
              <span className="reward-value">💎 0.1-0.5 SOL</span>
            </div>
            <button className="mode-btn" disabled={!selectedDeck}>开始匹配</button>
          </div>

          <div className="battle-mode-card">
            <div className="mode-icon">🏟️</div>
            <h3 className="mode-title">竞技场</h3>
            <p className="mode-desc">挑战AI对手，练习战斗技巧</p>
            <div className="mode-reward">
              <span>奖励:</span>
              <span className="reward-value">经验值 + 金币</span>
            </div>
            <button className="mode-btn secondary" disabled={!selectedDeck}>进入</button>
          </div>

          <div className="battle-mode-card">
            <div className="mode-icon">👥</div>
            <h3 className="mode-title">好友对战</h3>
            <p className="mode-desc">邀请好友进行友谊赛</p>
            <div className="mode-reward">
              <span>奖励:</span>
              <span className="reward-value">无</span>
            </div>
            <button className="mode-btn secondary" disabled={!selectedDeck}>创建房间</button>
          </div>
        </div>

        {/* 战绩统计 */}
        <div className="battle-stats">
          <h3>我的战绩</h3>
          <div className="stats-grid">
            <div className="stat-item">
              <span className="stat-value">{(playerProfile?.totalWins ?? 0) + (playerProfile?.totalLosses ?? 0)}</span>
              <span className="stat-label">总场次</span>
            </div>
            <div className="stat-item">
              <span className="stat-value win">{playerProfile?.totalWins ?? 0}</span>
              <span className="stat-label">胜利</span>
            </div>
            <div className="stat-item">
              <span className="stat-value lose">{playerProfile?.totalLosses ?? 0}</span>
              <span className="stat-label">失败</span>
            </div>
            <div className="stat-item">
              <span className="stat-value">
                {playerProfile && (playerProfile.totalWins + playerProfile.totalLosses) > 0
                  ? Math.round((playerProfile.totalWins / (playerProfile.totalWins + playerProfile.totalLosses)) * 100)
                  : 0}%
              </span>
              <span className="stat-label">胜率</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Battle
