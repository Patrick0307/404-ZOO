import '../css/Marketplace.css'

interface MarketplaceProps {
  onBack: () => void
}

const mockListings = [
  { id: 1, name: '暗影龙', rarity: 'SSR', price: 2.5, seller: '0x7a...3f' },
  { id: 2, name: '圣光凤', rarity: 'SSR', price: 1.8, seller: '0x4b...9c' },
  { id: 3, name: '风暴鹰', rarity: 'SR', price: 0.5, seller: '0x2d...1e' },
  { id: 4, name: '烈焰虎', rarity: 'SR', price: 0.4, seller: '0x8f...7a' },
]

function Marketplace({ onBack }: MarketplaceProps) {
  return (
    <div className="page-container">
      <div className="page-header">
        <span className="icon">🏪</span>
        <h2>市场</h2>
        <button className="back-btn" onClick={onBack}>返回</button>
      </div>

      <div className="marketplace-tabs">
        <button className="tab-btn active">购买</button>
        <button className="tab-btn">出售</button>
        <button className="tab-btn">我的挂单</button>
      </div>

      <div className="marketplace-grid">
        {mockListings.map(item => (
          <div key={item.id} className="market-card">
            <div className="market-card-image">
              <span className="market-rarity">{item.rarity}</span>
              <span className="creature-emoji">🐲</span>
            </div>
            <div className="market-card-info">
              <div className="market-card-name">{item.name}</div>
              <div className="market-card-seller">卖家: {item.seller}</div>
              <div className="market-card-footer">
                <span className="market-price">◎ {item.price} SOL</span>
                <button className="buy-btn">购买</button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default Marketplace
