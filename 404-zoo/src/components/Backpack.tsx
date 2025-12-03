import '../css/Backpack.css'

interface BackpackProps {
  onBack: () => void
}

const mockItems = [
  { id: 1, name: '火焰狐', rarity: 'SSR', element: '🔥', level: 15 },
  { id: 2, name: '冰霜熊', rarity: 'SR', element: '❄️', level: 12 },
  { id: 3, name: '雷电鹰', rarity: 'SR', element: '⚡', level: 10 },
  { id: 4, name: '森林鹿', rarity: 'R', element: '🌿', level: 8 },
  { id: 5, name: '水晶龟', rarity: 'R', element: '💧', level: 6 },
  { id: 6, name: '岩石犀', rarity: 'R', element: '🪨', level: 5 },
]

function Backpack({ onBack }: BackpackProps) {
  return (
    <div className="page-container">
      <div className="page-header">
        <span className="icon">🎒</span>
        <h2>背包</h2>
        <button className="back-btn" onClick={onBack}>返回</button>
      </div>
      
      <div className="backpack-filters">
        <button className="filter-btn active">全部</button>
        <button className="filter-btn">SSR</button>
        <button className="filter-btn">SR</button>
        <button className="filter-btn">R</button>
      </div>

      <div className="backpack-grid">
        {mockItems.map(item => (
          <div key={item.id} className={`creature-card ${item.rarity.toLowerCase()}`}>
            <div className="card-rarity">{item.rarity}</div>
            <div className="card-element">{item.element}</div>
            <div className="card-avatar">
              <span className="creature-emoji">🦊</span>
            </div>
            <div className="card-info">
              <span className="card-name">{item.name}</span>
              <span className="card-level">Lv.{item.level}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default Backpack
