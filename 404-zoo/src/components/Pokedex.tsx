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

interface PokedexProps {
  onBack: () => void
}

function Pokedex({ onBack }: PokedexProps) {
  const [cards, setCards] = useState<CardTemplate[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedCard, setSelectedCard] = useState<CardTemplate | null>(null)
  const [failedImages, setFailedImages] = useState<Set<number>>(new Set())

  useEffect(() => {
    loadCards()
  }, [])

  const loadCards = async () => {
    setLoading(true)
    try {
      // 使用缓存的卡片数据（已经按稀有度排序）
      const templates = await getCachedCards()
      setCards(templates)
      console.log('Loaded cards from cache:', templates.length)
    } catch (error) {
      console.error('Failed to load cards:', error)
    } finally {
      setLoading(false)
    }
  }

  const getRarityEmoji = (rarity: Rarity): string => {
    switch (rarity) {
      case Rarity.Common: return '⚪'
      case Rarity.Rare: return '🔵'
      case Rarity.Legendary: return '🟠'
      default: return '⚪'
    }
  }

  const getTraitEmoji = (traitType: number): string => {
    switch (traitType) {
      case 0: return '⚔️'
      case 1: return '🏹'
      case 2: return '🗡️'
      default: return '❓'
    }
  }

  const handleImageError = (cardId: number) => {
    setFailedImages(prev => new Set(prev).add(cardId))
  }

  const shouldShowImage = (card: CardTemplate): boolean => {
    return !!card.imageUri && card.imageUri.trim() !== '' && !failedImages.has(card.cardTypeId)
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <span className="icon">📖</span>
        <h2>Pokedex</h2>
        <button className="back-btn" onClick={onBack}>Back</button>
      </div>

      <div className="pokedex-stats">
        <div className="stat-box">
          <span className="value">{cards.length}</span>
          <span className="label">Cards Found</span>
        </div>
        <div className="stat-box">
          <span className="value">
            {cards.filter(c => c.rarity === Rarity.Legendary).length}
          </span>
          <span className="label">Legendary</span>
        </div>
      </div>

      {loading ? (
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <p>Loading cards from chain...</p>
        </div>
      ) : cards.length === 0 ? (
        <div className="empty-state">
          <p>No cards found on chain</p>
        </div>
      ) : (
        <div className="pokedex-grid">
          {cards.map(card => (
            <div
              key={card.cardTypeId}
              className={`pokedex-card owned rarity-${RarityToName[card.rarity]}`}
              onClick={() => setSelectedCard(card)}
              style={{ borderColor: RarityColors[card.rarity] }}
            >
              <div className="pokedex-avatar">
                {shouldShowImage(card) ? (
                  <img
                    src={getImageUrl(card.imageUri)}
                    alt={card.name}
                    onError={() => handleImageError(card.cardTypeId)}
                  />
                ) : (
                  <span className="fallback-icon">{getTraitEmoji(card.traitType)}</span>
                )}
              </div>
              <span className="pokedex-name">{card.name}</span>
              <span className="pokedex-rarity" style={{ color: RarityColors[card.rarity] }}>
                {getRarityEmoji(card.rarity)} {RarityNames[card.rarity]}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Card Detail Modal */}
      {selectedCard && (
        <div className="card-modal-overlay" onClick={() => setSelectedCard(null)}>
          <div className="card-modal" onClick={e => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setSelectedCard(null)}>×</button>
            
            <div className="modal-header" style={{ borderColor: RarityColors[selectedCard.rarity] }}>
              <h3 className="modal-name">{selectedCard.name}</h3>
              <span className="modal-rarity" style={{ color: RarityColors[selectedCard.rarity] }}>
                {getRarityEmoji(selectedCard.rarity)} {RarityNames[selectedCard.rarity]}
              </span>
            </div>

            <div className="modal-avatar">
              {shouldShowImage(selectedCard) ? (
                <img
                  src={getImageUrl(selectedCard.imageUri)}
                  alt={selectedCard.name}
                  onError={() => handleImageError(selectedCard.cardTypeId)}
                />
              ) : (
                <span className="fallback-icon">{getTraitEmoji(selectedCard.traitType)}</span>
              )}
            </div>

            <div className="modal-info">
              <div className="info-row">
                <span className="info-label">Class</span>
                <span className="info-value">
                  {getTraitEmoji(selectedCard.traitType)} {TraitTypeNames[selectedCard.traitType]}
                </span>
              </div>
              
              <div className="info-row">
                <span className="info-label">Attack</span>
                <span className="info-value stats">
                  ⚔️ {selectedCard.minAttack} - {selectedCard.maxAttack}
                </span>
              </div>
              
              <div className="info-row">
                <span className="info-label">Health</span>
                <span className="info-value stats">
                  ❤️ {selectedCard.minHealth} - {selectedCard.maxHealth}
                </span>
              </div>

              <div className="info-description">
                <span className="info-label">Description</span>
                <p>{selectedCard.description}</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default Pokedex
