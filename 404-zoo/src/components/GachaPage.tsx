import { useState } from 'react'
import '../css/GachaPage.css'
import {
  claimStarterTickets,
  gachaDraw,
  getPlayerProfile,
  getCardTemplate,
  type PlayerProfile,
  type GachaDrawResult,
  // RarityNames,
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

function GachaPage({ onBack: _onBack, playerProfile, onProfileUpdate }: GachaPageProps) {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const _unusedOnBack = _onBack
  const [isLoading, setIsLoading] = useState(false)
  const [recentDraws, setRecentDraws] = useState<DrawnCard[]>([])
  const [animationState, setAnimationState] = useState<AnimationState>('idle')
  const [currentCard, setCurrentCard] = useState<DrawnCard | null>(null)
  const [showFlash, setShowFlash] = useState(false)

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

  const handleTenDraw = async () => {
    if (!playerProfile || tickets < 10) return
    
    setIsLoading(true)
    try {
      const draws: DrawnCard[] = []
      for (let i = 0; i < 10; i++) {
        const result = await gachaDraw(playerProfile.wallet)
        const template = await getCardTemplate(result.cardTypeId)
        draws.push({ result, template })
      }
      setRecentDraws(prev => [...draws, ...prev].slice(0, 6))
      await refreshProfile()
    } catch (error) {
      console.error('Draw failed:', error)
    }
    setIsLoading(false)
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
            onClick={handleTenDraw}
            disabled={isLoading || tickets < 10}
          >
            {isLoading ? 'EXTRACTING...' : 'EXTRACT_TEN'}
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

          <div className="gacha-log-header" style={{ marginTop: '40px' }}>GACHA_LOG:</div>
          <div className="gacha-log-list">
            <div className="gacha-log-item">
              <div className="log-stars">★★★★ ★★★★</div>
            </div>
            <div className="gacha-log-item">
              <div className="log-stars">★★★</div>
              <div className="log-name">ERR.404_WOLF</div>
            </div>
          </div>

          <div className="gacha-coins-display">
            ERR_COINS: {tickets}
          </div>
        </div>
      </div>
    </div>
  )
}

export default GachaPage
