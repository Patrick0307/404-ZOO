import { useState, useEffect } from 'react'
import '../css/Battle.css'
import {
  getPlayerDecks,
  type PlayerProfile,
  type PlayerDeck,
} from '../services/contract'
import { getCachedPlayerDecks, hasPlayerDataCache } from '../services/playerDataCache'
import ArenaBattle from './ArenaBattle'

interface BattleProps {
  onBack: () => void
  playerProfile: PlayerProfile | null
}

// Battle mode types
type BattleMode = 'lobby' | 'arena' // Can extend other modes

function Battle({ onBack, playerProfile }: BattleProps) {
  // Basic state
  const [savedDecks, setSavedDecks] = useState<PlayerDeck[]>([])
  const [selectedDeck, setSelectedDeck] = useState<PlayerDeck | null>(null)

  
  // Current mode
  const [currentMode, setCurrentMode] = useState<BattleMode>('lobby')

  // Load decks - prioritize cache
  useEffect(() => {
    if (playerProfile) {
      loadSavedDecks()
    }
  }, [playerProfile])

  const loadSavedDecks = async () => {
    if (!playerProfile) return
    
    // Prioritize cache
    if (hasPlayerDataCache()) {
      const cachedDecks = getCachedPlayerDecks()
      if (cachedDecks.length > 0) {
        console.log('Using cached decks:', cachedDecks.length)
        setSavedDecks(cachedDecks)
        if (!selectedDeck) {
          setSelectedDeck(cachedDecks[0])
        }
        return
      }
    }
    
    // No cache, load from chain
    try {
      console.log('Loading decks from chain...')
      const decks = await getPlayerDecks(playerProfile.wallet)
      setSavedDecks(decks)
      if (decks.length > 0 && !selectedDeck) {
        setSelectedDeck(decks[0])
      }
    } catch (error) {
      console.error('Failed to load saved decks:', error)
    }
  }

  // Start Arena battle
  const startArenaBattle = () => {
    if (!selectedDeck) {
      alert('Please select a deck first!')
      return
    }
    if (selectedDeck.cardMints.length < 10) {
      alert(`Deck must have 10 cards! "${selectedDeck.deckName}" only has ${selectedDeck.cardMints.length} cards. Please edit it in Team Builder.`)
      return
    }
    setCurrentMode('arena')
  }

  // Return to lobby
  const returnToLobby = () => {
    setCurrentMode('lobby')
  }


  // Render lobby
  const renderLobby = () => (
    <div className="battle-lobby">
      {/* Left side - Mode Selection */}
      <div className="battle-left-section">
        <div className="battle-mode-selection">
          <h3>Please Choose Your Mode</h3>
          
          {/* Arena 模式 */}
          <div className="mode-card arena-mode" onClick={startArenaBattle}>
            {/* <div className="mode-icon">🏟️</div> */}
            <div className="mode-info">
              <h4>Arena Rank Mode</h4>
              <p>Auto Chess gameplay, drawing cards from the deck to build your lineup.</p>
            </div>
          </div>

          {/* Other mode placeholders - can be extended later */}
          <div className="mode-card other-mode disabled">
            {/* <div className="mode-icon">🎯</div> */}
            <div className="mode-info">
              <h4>Fast Mode</h4>
              <p>Coming Soon...</p>
            </div>
            <div className="coming-soon">Stay tuned</div>
          </div>

          <div className="mode-card other-mode disabled">
            {/* <div className="mode-icon">🏆</div> */}
            <div className="mode-info">
              <h4>Championship</h4>
              <p>Coming Soon...</p>
            </div>
            <div className="coming-soon">Stay tuned</div>
          </div>
        </div>
      </div>

      {/* Right side - Deck Selection and Rules Grid */}
      <div className="battle-sidebar">
        {/* Deck Selection */}
        <div className="deck-selection">
          <h3>Choose your deck</h3>
          {savedDecks.length === 0 ? (
            <div className="no-deck">Please create a deck in the Team page first</div>
          ) : (
            <div className="deck-list">
              {savedDecks.map(deck => {
                const isValid = deck.cardMints.length >= 10
                return (
                  <div
                    key={deck.deckIndex}
                    className={`deck-item ${selectedDeck?.deckIndex === deck.deckIndex ? 'selected' : ''} ${!isValid ? 'invalid' : ''}`}
                    onClick={() => setSelectedDeck(deck)}
                  >
                    <span className="deck-name">{deck.deckName}</span>
                    <span className={`deck-count ${!isValid ? 'warning' : ''}`}>
                      {deck.cardMints.length}/10 Cards {!isValid && '⚠️'}
                    </span>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Game Rules */}
        <div className="battle-rules">
          <h4>Arena Rules</h4>
          <ul>
            <li>Draw cards from a 10-card deck to build your battle lineup</li>
            <li>3 identical units can be combined to create a higher-star unit</li>
            <li>30 seconds of preparation time per turn</li>
            <li>Damage deducted upon defeat = number of turns²</li>
          </ul>
        </div>
      </div>
    </div>
  )

  // Render based on current mode
  if (currentMode === 'arena' && selectedDeck) {
    return (
      <ArenaBattle
        onBack={returnToLobby}
        playerProfile={playerProfile}
        selectedDeck={selectedDeck}
      />
    )
  }

  return (
    <div className="battle-container">
      <div className="battle-container-bg">
        <img src="/market-bg.png" alt="" className="background-image" />
      </div>
      <div className="lobby-header">
        <button className="back-btn" onClick={onBack}>Back</button>
        <h2>Fighting Mode</h2>
      </div>
      {renderLobby()}
    </div>
  )
}

export default Battle