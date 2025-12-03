import '../css/Pokedex.css'

interface PokedexProps {
  onBack: () => void
}

const allCreatures = [
  { id: 1, name: '火焰狐', element: '🔥', owned: true },
  { id: 2, name: '冰霜熊', element: '❄️', owned: true },
  { id: 3, name: '雷电鹰', element: '⚡', owned: true },
  { id: 4, name: '森林鹿', element: '🌿', owned: true },
  { id: 5, name: '水晶龟', element: '💧', owned: true },
  { id: 6, name: '岩石犀', element: '🪨', owned: true },
  { id: 7, name: '暗影龙', element: '🌙', owned: false },
  { id: 8, name: '圣光凤', element: '✨', owned: false },
  { id: 9, name: '风暴鹰', element: '🌪️', owned: false },
  { id: 10, name: '烈焰虎', element: '🔥', owned: false },
  { id: 11, name: '深海鲸', element: '💧', owned: false },
  { id: 12, name: '雷神兽', element: '⚡', owned: false },
]

function Pokedex({ onBack }: PokedexProps) {
  const ownedCount = allCreatures.filter(c => c.owned).length
  const totalCount = allCreatures.length

  return (
    <div className="page-container">
      <div className="page-header">
        <span className="icon">📖</span>
        <h2>图鉴</h2>
        <button className="back-btn" onClick={onBack}>返回</button>
      </div>

      <div className="pokedex-stats">
        <div className="stat-box">
          <span className="value">{ownedCount}/{totalCount}</span>
          <span className="label">收集进度</span>
        </div>
        <div className="stat-box">
          <span className="value">{Math.round(ownedCount/totalCount*100)}%</span>
          <span className="label">完成度</span>
        </div>
      </div>

      <div className="pokedex-grid">
        {allCreatures.map(creature => (
          <div 
            key={creature.id} 
            className={`pokedex-card ${creature.owned ? 'owned' : 'locked'}`}
          >
            <span className="pokedex-number">#{String(creature.id).padStart(3, '0')}</span>
            <div className="pokedex-avatar">
              {creature.owned && <span>{creature.element}</span>}
            </div>
            <span className="pokedex-name">
              {creature.owned ? creature.name : '???'}
            </span>
            {creature.owned && <span className="pokedex-element">{creature.element}</span>}
          </div>
        ))}
      </div>
    </div>
  )
}

export default Pokedex
