import { useState } from 'react'
import '../css/GachaPage.css'
import {
  claimStarterTickets,
  gachaDraw,
  getPlayerProfile,
  getCardTemplate,
  type PlayerProfile,
  type GachaDrawResult,
  RarityNames,
  type CardTemplate,
} from '../services/contract'

interface GachaPageProps {
  onBack: () => void
  playerProfile: PlayerProfile | null
  onProfileUpdate: (profile: PlayerProfile) => void
}

interface DrawnCard {
  result: GachaDrawResult
  template: CardTemplate | null
}

function GachaPage({ onBack, playerProfile, onProfileUpdate }: GachaPageProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [lastDrawnCard, setLastDrawnCard] = useState<DrawnCard | null>(null)

  const tickets = playerProfile?.gachaTickets ?? 0
  const hasClaimedFree = playerProfile?.hasClaimedStarterPack ?? false

  // 刷新玩家数据
  const refreshProfile = async () => {
    if (!playerProfile) return
    const updated = await getPlayerProfile(playerProfile.wallet)
    if (updated) {
      onProfileUpdate(updated)
    }
  }

  // 领取免费10抽
  const handleClaimFree = async () => {
    if (!playerProfile || hasClaimedFree) return
    
    setIsLoading(true)
    setMessage(null)
    
    try {
      await claimStarterTickets(playerProfile.wallet)
      await refreshProfile()
      setMessage({ type: 'success', text: '🎉 成功领取10张免费抽奖券！' })
    } catch (error) {
      console.error('Claim failed:', error)
      setMessage({ type: 'error', text: '领取失败，请重试' })
    }
    
    setIsLoading(false)
  }

  // 单抽
  const handleSingleDraw = async () => {
    if (!playerProfile || tickets < 1) return
    
    setIsLoading(true)
    setMessage(null)
    setLastDrawnCard(null)
    
    try {
      const result = await gachaDraw(playerProfile.wallet)
      const template = await getCardTemplate(result.cardTypeId)
      
      setLastDrawnCard({ result, template })
      await refreshProfile()
      
      const rarityText = template ? RarityNames[template.rarity] : 'Unknown'
      const cardName = template?.name ?? `Card #${result.cardTypeId}`
      setMessage({ type: 'success', text: `🎴 抽到了 ${cardName} (${rarityText})！` })
    } catch (error) {
      console.error('Draw failed:', error)
      setMessage({ type: 'error', text: '抽卡失败，请重试' })
    }
    
    setIsLoading(false)
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <span className="icon">🎴</span>
        <h2>抽卡</h2>
        <button className="back-btn" onClick={onBack}>返回</button>
      </div>

      <div className="gacha-content">
        {/* 抽奖券显示 */}
        <div className="ticket-display">
          <span className="ticket-icon">🎟️</span>
          <span className="ticket-count">{tickets}</span>
          <span className="ticket-label">抽奖券</span>
        </div>

        {/* 免费领取按钮 */}
        {!hasClaimedFree && (
          <button 
            className="claim-free-btn"
            onClick={handleClaimFree}
            disabled={isLoading}
          >
            {isLoading ? '领取中...' : '🎁 领取免费10抽'}
          </button>
        )}

        {/* 消息提示 */}
        {message && (
          <div className={`gacha-message ${message.type}`}>
            {message.text}
          </div>
        )}

        {/* 抽到的卡片展示 */}
        {lastDrawnCard && lastDrawnCard.template && (
          <div className={`drawn-card-display rarity-${lastDrawnCard.template.rarity}`}>
            <div className="drawn-card-image">
              {lastDrawnCard.template.imageUri ? (
                <img src={lastDrawnCard.template.imageUri} alt={lastDrawnCard.template.name} />
              ) : (
                <span className="card-placeholder">🃏</span>
              )}
            </div>
            <div className="drawn-card-info">
              <span className="drawn-card-name">{lastDrawnCard.template.name}</span>
              <span className="drawn-card-rarity">{RarityNames[lastDrawnCard.template.rarity]}</span>
            </div>
          </div>
        )}

        <div className="gacha-banner">
          <span className="banner-featured">🐉</span>
          <span className="banner-title">神龙降临</span>
          <span className="banner-subtitle">限定卡池 · SSR概率UP</span>
        </div>

        <div className="gacha-rates">
          <div className="rate-item">
            <span className="rate-badge legendary">传说</span>
            <span className="rate-value">3%</span>
          </div>
          <div className="rate-item">
            <span className="rate-badge rare">稀有</span>
            <span className="rate-value">27%</span>
          </div>
          <div className="rate-item">
            <span className="rate-badge common">普通</span>
            <span className="rate-value">70%</span>
          </div>
        </div>

        <div className="gacha-buttons">
          <button 
            className="gacha-btn single"
            onClick={handleSingleDraw}
            disabled={isLoading || tickets < 1}
          >
            <span className="btn-label">{isLoading ? '抽卡中...' : '单抽'}</span>
            <span className="btn-cost">🎟️ x1</span>
          </button>
        </div>

        {tickets === 0 && hasClaimedFree && (
          <div className="no-tickets-hint">
            暂无抽奖券，可通过对战获得奖励
          </div>
        )}
      </div>
    </div>
  )
}

export default GachaPage
