import { useState, useEffect } from 'react'
import '../css/TeamBuilder.css'
import {
  getPlayerCardsWithTemplates,
  getPlayerDecks,
  saveDeck,
  deleteDeck,
  type PlayerCard,
  type PlayerProfile,
  type PlayerDeck,
  Rarity,
} from '../services/contract'

interface TeamBuilderProps {
  onBack: () => void
  playerProfile: PlayerProfile | null
}

const MAX_TEAM_SIZE = 10
const MAX_DECKS = 5

function TeamBuilder({ onBack, playerProfile }: TeamBuilderProps) {
  const [cards, setCards] = useState<PlayerCard[]>([])
  const [team, setTeam] = useState<(PlayerCard | null)[]>(Array(MAX_TEAM_SIZE).fill(null))
  const [selectedCard, setSelectedCard] = useState<PlayerCard | null>(null)
  const [savedDecks, setSavedDecks] = useState<PlayerDeck[]>([])
  const [selectedDeckIndex, setSelectedDeckIndex] = useState<number | null>(null)
  const [deckName, setDeckName] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [isDeleting, setIsDeleting] = useState<number | null>(null)

  useEffect(() => {
    if (playerProfile) {
      loadCards()
      loadSavedDecks()
    }
  }, [playerProfile])

  const loadCards = async () => {
    if (!playerProfile) return
    setIsLoading(true)
    try {
      const playerCards = await getPlayerCardsWithTemplates(playerProfile.wallet)
      setCards(playerCards)
      if (playerCards.length > 0 && !selectedCard) {
        setSelectedCard(playerCards[0])
      }
    } catch (error) {
      console.error('Failed to load cards:', error)
    }
    setIsLoading(false)
  }

  const loadSavedDecks = async () => {
    if (!playerProfile) return
    try {
      const decks = await getPlayerDecks(playerProfile.wallet)
      setSavedDecks(decks)
    } catch (error) {
      console.error('Failed to load saved decks:', error)
    }
  }

  const isCardInTeam = (card: PlayerCard) => {
    return team.some(t => t && t.instance.mint.toBase58() === card.instance.mint.toBase58())
  }

  const addToTeam = () => {
    if (!selectedCard) return
    const emptyIndex = team.findIndex(slot => slot === null)
    if (emptyIndex === -1) return
    if (isCardInTeam(selectedCard)) return
    
    const newTeam = [...team]
    newTeam[emptyIndex] = selectedCard
    setTeam(newTeam)
  }

  const removeFromTeam = (index: number) => {
    const newTeam = [...team]
    newTeam[index] = null
    setTeam(newTeam)
  }

  const handleSaveDeck = async () => {
    if (!playerProfile) return
    const teamCards = team.filter((c): c is PlayerCard => c !== null)
    if (teamCards.length === 0) {
      alert('Please add cards to your team first')
      return
    }
    if (!deckName.trim()) {
      alert('Please enter a deck name')
      return
    }

    setIsSaving(true)
    try {
      const usedIndices = savedDecks.map(d => d.deckIndex)
      let newIndex = selectedDeckIndex

      if (newIndex === null) {
        for (let i = 0; i < MAX_DECKS; i++) {
          if (!usedIndices.includes(i)) {
            newIndex = i
            break
          }
        }
      }

      if (newIndex === null || newIndex >= MAX_DECKS) {
        alert(`Maximum ${MAX_DECKS} decks allowed`)
        setIsSaving(false)
        return
      }

      const cardMints = teamCards.map(c => c.instance.mint)
      await saveDeck(playerProfile.wallet, newIndex, deckName, cardMints)

      alert('Deck saved successfully!')
      await loadSavedDecks()
      
      setSelectedDeckIndex(null)
      setDeckName('')
    } catch (error) {
      console.error('Failed to save deck:', error)
      alert('Save failed: ' + (error as Error).message)
    }
    setIsSaving(false)
  }

  const handleDeleteDeck = async (deckIndex: number) => {
    if (!playerProfile) return
    if (!confirm('Delete this deck?')) return

    setIsDeleting(deckIndex)
    try {
      await deleteDeck(playerProfile.wallet, deckIndex)
      alert('Deck deleted')
      await loadSavedDecks()
      
      if (selectedDeckIndex === deckIndex) {
        setSelectedDeckIndex(null)
        setDeckName('')
        setTeam(Array(MAX_TEAM_SIZE).fill(null))
      }
    } catch (error) {
      console.error('Failed to delete deck:', error)
      alert('Delete failed: ' + (error as Error).message)
    }
    setIsDeleting(null)
  }

  const handleLoadDeck = (deck: PlayerDeck) => {
    setSelectedDeckIndex(deck.deckIndex)
    setDeckName(deck.deckName)
    
    const deckCards: (PlayerCard | null)[] = Array(MAX_TEAM_SIZE).fill(null)
    deck.cardMints.forEach((mint, index) => {
      const found = cards.find(c => c.instance.mint.toBase58() === mint.toBase58())
      if (found && index < MAX_TEAM_SIZE) {
        deckCards[index] = found
      }
    })
    setTeam(deckCards)
  }

  const handleNewDeck = () => {
    setSelectedDeckIndex(null)
    setDeckName('')
    setTeam(Array(MAX_TEAM_SIZE).fill(null))
  }

  const getStars = (rarity: number) => {
    switch (rarity) {
      case Rarity.Legendary: return 5
      case Rarity.Rare: return 4
      default: return 3
    }
  }

  const getRarityName = (rarity: number) => {
    switch (rarity) {
      case Rarity.Legendary: return 'LEGENDARY'
      case Rarity.Rare: return 'RARE'
      default: return 'COMMON'
    }
  }

  const getTypeName = (traitType: number) => {
    switch (traitType) {
      case 0: return 'warrior'
      case 1: return 'archer'
      case 2: return 'assassin'
      default: return 'unknown'
    }
  }

  return (
    <div className="team-builder-container">
      <div className="team-title">TEAM_NODE // DECK BUILDER</div>

      {/* Saved Decks Section */}
      <div className="saved-decks-bar">
        <div className="saved-decks-label">SAVED_DECKS ({savedDecks.length}/{MAX_DECKS}):</div>
        <div className="saved-decks-list">
          {savedDecks.map((deck) => (
            <button
              key={deck.deckIndex}
              className={`saved-deck-btn ${selectedDeckIndex === deck.deckIndex ? 'active' : ''}`}
              onClick={() => handleLoadDeck(deck)}
            >
              {deck.deckName}
            </button>
          ))}
          <button 
            className="new-deck-btn-cyber"
            onClick={handleNewDeck}
            disabled={savedDecks.length >= MAX_DECKS && selectedDeckIndex === null}
          >
            + NEW
          </button>
        </div>
      </div>

      {/* Deck Name Input */}
      <div className="deck-name-section">
        <input
          type="text"
          placeholder="DECK_NAME..."
          value={deckName}
          onChange={(e) => setDeckName(e.target.value)}
          maxLength={32}
          className="deck-name-input"
        />
        <button 
          className="save-deck-btn-cyber"
          onClick={handleSaveDeck}
          disabled={isSaving || team.every(slot => slot === null) || !deckName.trim()}
        >
          {isSaving ? 'SAVING...' : selectedDeckIndex !== null ? 'UPDATE_DECK' : 'SAVE_TO_CHAIN'}
        </button>
        {selectedDeckIndex !== null && (
          <button 
            className="delete-deck-btn-cyber"
            onClick={() => handleDeleteDeck(selectedDeckIndex)}
            disabled={isDeleting === selectedDeckIndex}
          >
            {isDeleting === selectedDeckIndex ? '...' : 'DELETE'}
          </button>
        )}
      </div>

      <div className="team-content">
        <div className="team-left-section">
          <div className="active-team-section">
            <div className="section-header-team">ACTIVE TEAM</div>
            <div className="team-slots-grid">
              {team.slice(0, 5).map((card, i) => (
                <div 
                  key={i} 
                  className={`team-slot-cyber ${card ? 'filled' : 'empty'} ${card ? `rarity-${card.template?.rarity ?? 0}` : ''}`}
                  onClick={() => card && removeFromTeam(i)}
                >
                  {card ? (
                    <>
                      <div className="slot-stars">
                        {'★'.repeat(getStars(card.template?.rarity ?? 0))}
                      </div>
                      <div className="slot-image">
                        {card.template?.imageUri ? (
                          <img src={card.template.imageUri} alt={card.template.name} />
                        ) : '🃏'}
                      </div>
                      <div className="slot-label">
                        ERR: {card.instance.cardTypeId}
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="slot-stars"></div>
                      <div className="slot-image"></div>
                      <div className="slot-label empty-label">SLOT</div>
                    </>
                  )}
                </div>
              ))}
            </div>
            
            <div className="team-slots-grid">
              {team.slice(5, 10).map((card, i) => {
                const index = i + 5
                return (
                  <div 
                    key={index} 
                    className={`team-slot-cyber ${card ? 'filled' : 'empty'} ${card ? `rarity-${card.template?.rarity ?? 0}` : ''}`}
                    onClick={() => card && removeFromTeam(index)}
                  >
                    {card ? (
                      <>
                        <div className="slot-stars">
                          {'★'.repeat(getStars(card.template?.rarity ?? 0))}
                        </div>
                        <div className="slot-image">
                          {card.template?.imageUri ? (
                            <img src={card.template.imageUri} alt={card.template.name} />
                          ) : '🃏'}
                        </div>
                        <div className="slot-label">
                          ERR: {card.instance.cardTypeId}
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="slot-stars"></div>
                        <div className="slot-image"></div>
                        <div className="slot-label empty-label">SLOT</div>
                      </>
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          <div className="your-cards-section">
            <div className="section-header-team">YOUR CARDS ({cards.length})</div>
            {isLoading ? (
              <div className="loading-state-team">LOADING...</div>
            ) : cards.length === 0 ? (
              <div className="empty-state-team">NO_CARDS_FOUND // GO TO GACHA</div>
            ) : (
              <div className="your-cards-grid">
                {cards.map((card) => {
                  const inTeam = isCardInTeam(card)
                  return (
                    <div 
                      key={card.instance.mint.toBase58()} 
                      className={`your-card-cyber ${inTeam ? 'in-team' : ''} rarity-${card.template?.rarity ?? 0}`}
                      onClick={() => !inTeam && setSelectedCard(card)}
                    >
                      <div className="card-stars-cyber">
                        {'★'.repeat(getStars(card.template?.rarity ?? 0))}
                      </div>
                      <div className="card-image-cyber">
                        {card.template?.imageUri ? (
                          <img src={card.template.imageUri} alt={card.template.name} />
                        ) : '🃏'}
                      </div>
                      <div className="card-label-cyber">
                        ERR: {card.instance.cardTypeId}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        {selectedCard && (
          <div className="team-info-panel">
            <div className="info-header-team">ITEM_INFO</div>
            <div className="info-name-team">
              {selectedCard.template?.name ?? `MK-${selectedCard.instance.cardTypeId}_WOLF`}
            </div>
            
            <div className="info-row-team">
              <span className="info-label-team">RARITY:</span>
              <span className="info-value-team rare">
                {getRarityName(selectedCard.template?.rarity ?? 0)}
              </span>
            </div>
            <div className="info-row-team">
              <span className="info-label-team">TYPE:</span>
              <span className="info-value-team">
                {getTypeName(selectedCard.template?.traitType ?? 0)}
              </span>
            </div>
            <div className="info-row-team">
              <span className="info-label-team">ATK_CODE:</span>
              <span className="info-value-team">{selectedCard.instance.attack}</span>
            </div>
            <div className="info-row-team">
              <span className="info-label-team">HP:</span>
              <span className="info-value-team">{selectedCard.instance.health}</span>
            </div>

            <div className="info-log-team">
              <div className="log-title-team">DATA_LOG:</div>
              <div className="log-text-team">
                Missing file....<br/>
                creature found instead.
              </div>
            </div>

            <button 
              className="add-to-team-btn"
              onClick={addToTeam}
              disabled={isCardInTeam(selectedCard) || team.every(slot => slot !== null)}
            >
              ADD TO TEAM
            </button>
            <button 
              className="remove-btn-team"
              onClick={() => {
                const index = team.findIndex(t => t && t.instance.mint.toBase58() === selectedCard.instance.mint.toBase58())
                if (index !== -1) removeFromTeam(index)
              }}
              disabled={!isCardInTeam(selectedCard)}
            >
              REMOVE
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

export default TeamBuilder
