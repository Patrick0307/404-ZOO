import { useState } from 'react'
import '../css/Marketplace.css'

const mockListings = [
  { id: 1, name: 'ER-403_WOLF', rarity: 'RARE', stars: 3, price: 125, errCode: 'R404', atk: 40, hp: 120, type: 'warrior' },
  { id: 2, name: 'ER-500_BEAR', rarity: 'RARE', stars: 3, price: 125, errCode: 'R770', atk: 45, hp: 110, type: 'warrior' },
  { id: 3, name: 'ER-404_DEER', rarity: 'RARE', stars: 3, price: 125, errCode: 'R666', atk: 38, hp: 130, type: 'warrior' },
  { id: 4, name: 'ER-451_PHOENIX', rarity: 'SUPER_RARE', stars: 3, price: 125, errCode: 'R999', atk: 42, hp: 115, type: 'assassin' },
  { id: 5, name: 'ER-302_FOX', rarity: 'SUPER_RARE', stars: 3, price: 125, errCode: 'R555', atk: 41, hp: 118, type: 'warrior' },
  { id: 6, name: 'ER-418_TEAPOT_GIANT', rarity: 'SUPER_RARE', stars: 3, price: 125, errCode: 'R888', atk: 43, hp: 122, type: 'assassin' },
]

function Marketplace() {
  const [selectedCard, setSelectedCard] = useState(mockListings[0])

  return (
    <div className="marketplace-container">
      {/* 顶部标签栏 */}
      <div className="market-tabs">
        <button className="market-tab active">MARKET_MODE</button>
        <button className="market-tab">MONSTER_CARDS</button>
        <button className="market-tab">DATA_CHIPS</button>
        <button className="market-tab">EVOLUTION_CORE</button>
        <button className="market-tab">PACKS</button>
      </div>

      <div className="market-content">
        {/* 左侧过滤器 */}
        <div className="market-sidebar">
          <div className="filter-section">
            <div className="filter-header">FILTER_MODE</div>
            <div className="filter-status">// ACTIVE</div>
          </div>

          <div className="filter-section">
            <div className="filter-title">RARITY</div>
            <label className="filter-checkbox">
              <input type="checkbox" checked />
              <span className="checkbox-icon">☑</span>
              <span>COMMON</span>
            </label>
            <label className="filter-checkbox active">
              <input type="checkbox" checked />
              <span className="checkbox-icon">☑</span>
              <span>RARE</span>
            </label>
          </div>

          <div className="filter-section">
            <div className="filter-title">TYPE <span className="type-value">warrior</span></div>
            <button className="type-btn active">warrior</button>
            <button className="type-btn">assassin</button>
            <button className="type-btn">EMONET</button>
            <button className="type-btn">EPERM</button>
          </div>

          <div className="filter-section">
            <div className="filter-title">ERROR_CODE</div>
            <div className="error-codes">
              <span className="error-code">R404</span>
              <span className="error-code">R770</span>
              <span className="error-code">EEQENT</span>
              <span className="error-code">EEPRM</span>
            </div>
          </div>

          <div className="market-footer-stats">
            <div>⊞⊞ ERR.1200</div>
            <div>⊟ BAG</div>
          </div>
        </div>

        {/* 中间卡片网格 */}
        <div className="market-grid">
          {mockListings.map(card => (
            <div 
              key={card.id} 
              className={`market-card-cyber ${selectedCard.id === card.id ? 'selected' : ''}`}
              onClick={() => setSelectedCard(card)}
            >
              <div className="card-image-cyber">
                <img src={`/card-${card.id}.png`} alt={card.name} />
              </div>
              <div className="card-stars">
                {'★'.repeat(card.stars)}
              </div>
              <div className="card-rarity-cyber">{card.rarity}</div>
              <div className="card-price-cyber">PRICE: {card.price}</div>
            </div>
          ))}
        </div>

        {/* 右侧信息面板 */}
        <div className="market-info-panel">
          <div className="info-header">ITEM_INFO</div>
          <div className="info-name">{selectedCard.name}</div>
          
          <div className="info-row">
            <span className="info-label">RARITY:</span>
            <span className="info-value rare">{selectedCard.rarity}</span>
          </div>
          <div className="info-row">
            <span className="info-label">TYPE:</span>
            <span className="info-value">{selectedCard.type}</span>
          </div>
          <div className="info-row">
            <span className="info-label">ERR_CODE:</span>
            <span className="info-value">{selectedCard.errCode}</span>
          </div>
          <div className="info-row">
            <span className="info-label">ATK:</span>
            <span className="info-value">{selectedCard.atk}</span>
          </div>
          <div className="info-row">
            <span className="info-label">HP:</span>
            <span className="info-value">{selectedCard.hp}</span>
          </div>

          <div className="info-log">
            <div className="log-title">DATA_LOG:</div>
            <div className="log-text">
              'Missing ffls...<br/>
              creature found<br/>
              instead.'
            </div>
          </div>

          <button className="acquire-btn">ACQUIRE</button>
          <button className="inspect-btn">INSPECT</button>
        </div>
      </div>

      {/* 底部状态栏 */}
      <div className="market-status-bar">
        <div>ERR_COINS: 1200</div>
        <div>⊟ DATA_CHIP: 5</div>
      </div>
    </div>
  )
}

export default Marketplace
