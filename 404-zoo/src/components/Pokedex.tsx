import { useState, useEffect } from 'react'
import '../css/Pokedex.css'
import type { CardTemplate } from '../services/contract'
import {
  TraitTypeNames,
  RarityNames,
  RarityColors,
  RarityToName,
  Rarity,
} from '../services/contract'
import { getCachedCards, getImageUrl } from '../services/cardCache'
import Model3DViewer from './Model3DViewer'

function Pokedex() {
  const [cards, setCards] = useState<CardTemplate[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedCard, setSelectedCard] = useState<CardTemplate | null>(null)
  const [failedImages, setFailedImages] = useState<Set<number>>(new Set())
  const [isClosing, setIsClosing] = useState(false)
  const [show3D, setShow3D] = useState(false)
  const [cardFlipping, setCardFlipping] = useState(false)

  useEffect(() => {
    loadCards()
  }, [])

  const loadCards = async () => {
    setLoading(true)
    try {
      // Use cached card data (already sorted by rarity)
      const templates = await getCachedCards()
      setCards(templates)
      console.log('Loaded cards from cache:', templates.length)
    } catch (error) {
      console.error('Failed to load cards:', error)
    } finally {
      setLoading(false)
    }
  }

  const getRarityStars = (rarity: Rarity): string => {
    switch (rarity) {
      case Rarity.Common: return '★★★'
      case Rarity.Rare: return '★★★★'
      case Rarity.Legendary: return '★★★★★'
      default: return '★★★'
    }
  }

  const getTraitIcon = (traitType: number): string => {
    switch (traitType) {
      case 0: return 'ATK'
      case 1: return 'RNG'
      case 2: return 'MEL'
      default: return 'UNK'
    }
  }

  const handleImageError = (cardId: number) => {
    setFailedImages(prev => new Set(prev).add(cardId))
  }

  const shouldShowImage = (card: CardTemplate): boolean => {
    return !!card.imageUri && card.imageUri.trim() !== '' && !failedImages.has(card.cardTypeId)
  }

  const handleCloseModal = () => {
    if (show3D) {
      // 如果在3D视图，先关闭3D视图
      setShow3D(false)
      setCardFlipping(true)
      setTimeout(() => {
        setCardFlipping(false)
        setSelectedCard(null)
      }, 800)
    } else {
      // 正常关闭模态框
      setIsClosing(true)
      setTimeout(() => {
        setSelectedCard(null)
        setIsClosing(false)
      }, 500)
    }
  }

  const handleCardClick = (card: CardTemplate) => {
    // 只负责选择卡片，显示模态框
    setSelectedCard(card)
    setShow3D(false)
    setCardFlipping(false)
  }

  const handleModalCardClick = () => {
    // 在模态框中点击卡片图片触发3D效果
    console.log('Modal card clicked, show3D:', show3D)
    if (!show3D) {
      console.log('Starting card flip animation')
      setCardFlipping(true)
      setTimeout(() => {
        console.log('Activating 3D view')
        setShow3D(true)
        setCardFlipping(false)
      }, 800) // 卡片倒下动画时间
    }
  }

  return (
    <div className="pokedex-container">
      <div className="pokedex-title">COLLECTION_DB // CARD_ARCHIVE</div>

      <div className="pokedex-stats-cyber">
        <div className="stat-box-cyber">
          <span className="value">{cards.length}</span>
          <span className="label">CARDS_FOUND</span>
        </div>
        <div className="stat-box-cyber">
          <span className="value">
            {cards.filter(c => c.rarity === Rarity.Legendary).length}
          </span>
          <span className="label">LEGENDARY</span>
        </div>
      </div>

      {loading ? (
        <div className="loading-container-cyber">
          <div className="loading-spinner-cyber"></div>
          <p>LOADING_CARDS...</p>
        </div>
      ) : cards.length === 0 ? (
        <div className="empty-state-cyber">
          <p>NO_CARDS_FOUND</p>
        </div>
      ) : (
        <div className="pokedex-grid-cyber">
          {cards.map(card => (
            <div
              key={card.cardTypeId}
              className={`pokedex-card-cyber rarity-${RarityToName[card.rarity]}`}
              onClick={() => handleCardClick(card)}
            >
              <div className="card-stars" style={{ color: RarityColors[card.rarity] }}>
                {getRarityStars(card.rarity)}
              </div>
              <div className="pokedex-avatar-cyber">
                {shouldShowImage(card) ? (
                  <img
                    src={getImageUrl(card.imageUri)}
                    alt={card.name}
                    onError={() => handleImageError(card.cardTypeId)}
                  />
                ) : (
                  <span className="fallback-icon">{getTraitIcon(card.traitType)}</span>
                )}
              </div>
              <span className="pokedex-name-cyber">{card.name}</span>
              <span className="pokedex-error-code">ERR: {card.cardTypeId}</span>
            </div>
          ))}
        </div>
      )}

      {/* MTG-Style Card Detail Modal */}
      {selectedCard && (
        <div className={`card-modal-overlay-mtg ${isClosing ? 'closing' : ''}`} onClick={show3D ? undefined : handleCloseModal}>
          <div className={`mtg-card ${isClosing ? 'closing' : ''} ${cardFlipping ? 'flipping' : ''} ${show3D ? 'show-3d' : ''}`} onClick={e => e.stopPropagation()}>
            <div className="mtg-card-inner">
              {/* Card Border with Glow */}
              <div className={`mtg-border rarity-${RarityToName[selectedCard.rarity]}`}>
                {/* Top Section - Name Only */}
                <div className="mtg-header">
                  <div className="mtg-name-box">
                    <h2 className="mtg-card-name">{selectedCard.name}</h2>
                  </div>
                </div>

                {/* Image Section */}
                <div className="mtg-image-frame">
                  <div className={`mtg-image-container ${!show3D ? 'clickable-for-3d' : ''}`} onClick={handleModalCardClick}>
                    {shouldShowImage(selectedCard) ? (
                      <img
                        src={getImageUrl(selectedCard.imageUri)}
                        alt={selectedCard.name}
                        className="mtg-card-image"
                        onError={() => handleImageError(selectedCard.cardTypeId)}
                      />
                    ) : (
                      <div className="mtg-fallback-image">
                        <span className="fallback-icon-large">{getTraitIcon(selectedCard.traitType)}</span>
                      </div>
                    )}
                    {!show3D && (
                      <div className="click-for-3d-hint">
                        <span>CLICK FOR 3D VIEW</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Type Line with Stats */}
                <div className="mtg-type-section">
                  <div className="mtg-type-line">
                    <div className="mtg-type-text">
                      {RarityNames[selectedCard.rarity]} Creature — {TraitTypeNames[selectedCard.traitType]}
                    </div>
                  </div>
                  <div className="mtg-stats-box">
                    <div className="stat-label">Attack:</div>
                    <div className="stat-value">{selectedCard.minAttack}-{selectedCard.maxAttack}</div>
                    <div className="stat-separator">/</div>
                    <div className="stat-label">Health:</div>
                    <div className="stat-value">{selectedCard.minHealth}-{selectedCard.maxHealth}</div>
                  </div>
                </div>

                {/* Text Box */}
                <div className="mtg-text-box">
                  <p className="mtg-description">{selectedCard.description}</p>
                  <div className="mtg-flavor-text">
                    <em>"In the depths of the 404 Zoo, legends are born from chaos."</em>
                  </div>
                </div>

                {/* Bottom Info */}
                <div className="mtg-bottom-info">
                  <span className="mtg-set-info">404 ZOO</span>
                  <span className="mtg-rarity-symbol" style={{ color: RarityColors[selectedCard.rarity] }}>
                    {getRarityStars(selectedCard.rarity)}
                  </span>
                  <span className="mtg-card-number">#{selectedCard.cardTypeId}</span>
                </div>
              </div>
            </div>
            
            <button className="mtg-close-btn" onClick={handleCloseModal}>✕</button>
          </div>
          
          {/* 3D Model Viewer */}
          <Model3DViewer 
            modelPath="/overflow_seraph figure 3d model.glb"
            isVisible={show3D}
            onClose={() => setShow3D(false)}
          />
        </div>
      )}
    </div>
  )
}

export default Pokedex
