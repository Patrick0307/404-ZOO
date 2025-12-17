import { useState } from 'react'
import '../css/GachaPage.css'
import {
  claimStarterTickets,
  gachaDraw,
  gachaDrawMultiple,
  getPlayerProfile,
  getCardTemplate,
  type PlayerProfile,
  type GachaDrawResult,
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

type AnimationState = 'idle' | 'charging' | 'overload' | 'revealing' | 'flipping' | 'complete' | 'fading'
type TenDrawState = 'idle' | 'loading' | 'revealing' | 'flipping' | 'complete'

function GachaPage({ playerProfile, onProfileUpdate }: GachaPageProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [recentDraws, setRecentDraws] = useState<DrawnCard[]>([])
  const [animationState, setAnimationState] = useState<AnimationState>('idle')
  const [currentCard, setCurrentCard] = useState<DrawnCard | null>(null)
  const [showFlash, setShowFlash] = useState(false)
  
  // 10 抽状态
  const [tenDrawState, setTenDrawState] = useState<TenDrawState>('idle')
  const [tenDrawCards, setTenDrawCards] = useState<DrawnCard[]>([])

  const tickets = playerProfile?.gachaTickets ?? 0
  const hasClaimedFree = playerProfile?.hasClaimedStarterPack ?? false

  const refreshProfile = async () => {
    if (!playerProfile) return
    const updated = await getPlayerProfile(playerProfile.wallet)
    if (updated) {
      onProfileUpdate(updated)
    }
  }

  const handleClaimFree = async () => {
    if (!playerProfile || hasClaimedFree) return
    
    setIsLoading(true)
    try {
      await claimStarterTickets(playerProfile.wallet)
      await refreshProfile()
    } catch (error) {
      console.error('Claim failed:', error)
    }
    setIsLoading(false)
  }

  const handleSingleDraw = async () => {
    if (!playerProfile || tickets < 1 || animationState !== 'idle') return
    
    setIsLoading(true)
    
    try {
      // Start drawing from contract
      const result = await gachaDraw(playerProfile.wallet)
      const template = await getCardTemplate(result.cardTypeId)
      const drawnCard = { result, template }
      
      // Phase 1: Charging (0.3s)
      setAnimationState('charging')
      
      await new Promise(resolve => setTimeout(resolve, 300))
      
      // Phase 2: Overload (1.2s)
      setAnimationState('overload')
      
      await new Promise(resolve => setTimeout(resolve, 1200))
      
      // Flash effect
      setShowFlash(true)
      setTimeout(() => setShowFlash(false), 300)
      
      await new Promise(resolve => setTimeout(resolve, 500))
      
      // Phase 3: Revealing card back
      setCurrentCard(drawnCard)
      setAnimationState('revealing')
      
      await new Promise(resolve => setTimeout(resolve, 2000))
      
      // Phase 4: Auto flip to show card front (slow flip)
      setAnimationState('flipping')
      
      // Legendary card gets extra flash when flipping
      const isLegendary = template?.rarity === 2
      if (isLegendary) {
        setTimeout(() => {
          setShowFlash(true)
          setTimeout(() => setShowFlash(false), 200)
        }, 750)
      }
      
      // Wait longer for legendary cards to show off
      await new Promise(resolve => setTimeout(resolve, isLegendary ? 3000 : 2000))
      
      // Phase 5: Complete - add to log
      setAnimationState('complete')
      setRecentDraws(prev => [drawnCard, ...prev].slice(0, 6))
      
      await new Promise(resolve => setTimeout(resolve, 1500))
      
      // Phase 6: Fade out
      setAnimationState('fading')
      
      await new Promise(resolve => setTimeout(resolve, 1500))
      
      // Reset to idle
      setAnimationState('idle')
      setCurrentCard(null)
      
      await refreshProfile()
    } catch (error) {
      console.error('Draw failed:', error)
      setAnimationState('idle')
      setCurrentCard(null)
    }
    setIsLoading(false)
  }
  
  const handleCardClick = () => {
    if (animationState === 'revealing') {
      setAnimationState('flipping')
    }
  }

  const handleFiveDraw = async () => {
    if (!playerProfile || tickets < 5 || tenDrawState !== 'idle') return
    
    setIsLoading(true)
    setTenDrawState('loading')
    
    try {
      // 使用 gachaDrawMultiple，一次签名 5 个交易
      const results = await gachaDrawMultiple(playerProfile.wallet, 5)
      
      // 获取所有卡片模板（串行获取，避免 rate limit）
      const draws: DrawnCard[] = []
      for (const result of results) {
        const template = await getCardTemplate(result.cardTypeId)
        draws.push({ result, template })
        await new Promise(resolve => setTimeout(resolve, 100))
      }
      
      // 设置卡片数据
      setTenDrawCards(draws)
      
      // Phase 1: Flash + 显示卡背
      setShowFlash(true)
      setTimeout(() => setShowFlash(false), 300)
      setTenDrawState('revealing')
      
      await new Promise(resolve => setTimeout(resolve, 1500))
      
      // Phase 2: 翻转所有卡片
      setTenDrawState('flipping')
      
      // 检查是否有传说卡
      const hasLegendary = draws.some(d => d.template?.rarity === 2)
      if (hasLegendary) {
        setTimeout(() => {
          setShowFlash(true)
          setTimeout(() => setShowFlash(false), 200)
        }, 750)
      }
      
      await new Promise(resolve => setTimeout(resolve, 2500))
      
      // Phase 3: 完成
      setTenDrawState('complete')
      setRecentDraws(prev => [...draws, ...prev].slice(0, 10))
      
      await new Promise(resolve => setTimeout(resolve, 3000))
      
      // 重置
      setTenDrawState('idle')
      setTenDrawCards([])
      
      await refreshProfile()
    } catch (error) {
      console.error('Draw failed:', error)
      setTenDrawState('idle')
      setTenDrawCards([])
    }
    setIsLoading(false)
  }
  
  const handleTenDrawClose = () => {
    if (tenDrawState === 'complete') {
      setTenDrawState('idle')
      setTenDrawCards([])
    }
  }

  const getStars = (rarity: number) => {
    switch (rarity) {
      case 2: return 5
      case 1: return 4
      default: return 3
    }
  }

  return (
    <div className={`gacha-container gacha--${animationState}`}>
      {/* Screen overlay */}
      {animationState !== 'idle' && (
        <div className="gacha-overlay" />
      )}
      
      {/* Flash effect */}
      {showFlash && <div className="screen-flash" />}
      
      {/* 10 抽卡片展示 (5x2 网格) */}
      {tenDrawState !== 'idle' && tenDrawState !== 'loading' && (
        <div className="ten-draw-overlay" onClick={handleTenDrawClose}>
          <div className="ten-draw-container">
            <div className="ten-draw-grid">
              {tenDrawCards.map((card, index) => (
                <div 
                  key={index}
                  className={`ten-draw-card ${tenDrawState === 'flipping' || tenDrawState === 'complete' ? 'flipped' : ''} rarity-${card.template?.rarity ?? 0}`}
                  style={{ animationDelay: `${index * 0.1}s` }}
                >
                  {/* Card back */}
                  <div className="card-back">
                    <div className="card-back-content">
                      <div className="card-back-logo">⚠</div>
                      <div className="card-back-text">ERROR</div>
                    </div>
                  </div>
                  
                  {/* Card front */}
                  <div className="card-front">
                    <div className="card-front-stars">
                      {'★'.repeat(getStars(card.template?.rarity ?? 0))}
                    </div>
                    <div className="card-front-image">
                      {card.template?.imageUri ? (
                        <img src={card.template.imageUri} alt={card.template.name} />
                      ) : (
                        <span className="card-fallback">🃏</span>
                      )}
                    </div>
                    <div className="card-front-name">
                      {card.template?.name ?? `ERR.${card.result.cardTypeId}`}
                    </div>
                  </div>
                </div>
              ))}
            </div>
            {tenDrawState === 'complete' && (
              <div className="ten-draw-hint">CLICK_TO_CLOSE</div>
            )}
          </div>
        </div>
      )}
      
      {/* Card reveal */}
      {currentCard && animationState !== 'idle' && (
        <div className="card-reveal-container">
          <div 
            className={`card-reveal ${animationState === 'flipping' || animationState === 'complete' ? 'flipped' : 'showing-back'} rarity-${currentCard.template?.rarity ?? 0}`}
            onClick={handleCardClick}
          >
            {/* Card back */}
            <div className="card-back">
              <div className="card-back-content">
                <div className="card-back-logo">⚠</div>
                <div className="card-back-text">ERROR</div>
              </div>
            </div>
            
            {/* Card front */}
            <div className="card-front">
              <div className="card-front-stars">
                {'★'.repeat(getStars(currentCard.template?.rarity ?? 0))}
              </div>
              <div className="card-front-image">
                {currentCard.template?.imageUri ? (
                  <img src={currentCard.template.imageUri} alt={currentCard.template.name} />
                ) : (
                  <span className="card-fallback">🃏</span>
                )}
              </div>
              <div className="card-front-name">
                {currentCard.template?.name ?? `ERR.${currentCard.result.cardTypeId}_WOLF`}
              </div>
            </div>
          </div>
        </div>
      )}
      
      <div className="gacha-title">
        GACHA_NODE // ERROR_SUMMON_PROTOCOL
        <span className="terminal-cursor">_</span>
      </div>

      <div className="gacha-content-layout">
        {/* 左侧：警告图标和按钮 */}
        <div className="gacha-left">
          <div className={`gacha-warning-icon core-${animationState}`}>
            <img src="/gacha-warning.png" alt="Warning" className="warning-image" />
          </div>

          <button 
            className={`extract-btn btn-${animationState}`}
            onClick={handleSingleDraw}
            disabled={isLoading || tickets < 1 || animationState !== 'idle'}
          >
            {isLoading ? 'EXTRACTING...' : 'EXTRACT_ONE'}
          </button>

          <button 
            className="extract-btn"
            onClick={handleFiveDraw}
            disabled={isLoading || tickets < 5}
          >
            {isLoading ? 'EXTRACTING...' : 'EXTRACT_FIVE'}
          </button>

          {!hasClaimedFree && (
            <button 
              className="claim-free-btn-cyber"
              onClick={handleClaimFree}
              disabled={isLoading}
            >
              {isLoading ? 'CLAIMING...' : 'CLAIM_FREE_10'}
            </button>
          )}
        </div>

        {/* 右侧：抽卡日志 */}
        <div className="gacha-right">
          <div className="gacha-log-header">GACHA_LOG:</div>
          
          <div className="gacha-log-list">
            {recentDraws.length === 0 ? (
              <div className="gacha-log-empty">NO_RECENT_DRAWS</div>
            ) : (
              recentDraws.map((draw, index) => (
                <div key={index} className="gacha-log-item">
                  <div className="log-stars">
                    {'★'.repeat(getStars(draw.template?.rarity ?? 0))}
                  </div>
                  <div className="log-name">
                    {draw.template?.name ?? `ERR.${draw.result.cardTypeId}_WOLF`}
                  </div>
                </div>
              ))
            )}
          </div>



          <div className="gacha-coins-display">
            BUG_TICKET: {tickets}
          </div>
        </div>
      </div>
    </div>
  )
}

export default GachaPage
