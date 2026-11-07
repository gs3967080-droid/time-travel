function formatYear(year) {
  if (!Number.isFinite(year)) return '年代未录入'
  return year < 0 ? `公元前${Math.abs(year)}年` : `公元${year}年`
}

function shortYear(year) {
  if (!Number.isFinite(year)) return '？'
  return year < 0 ? `前${Math.abs(year)}` : `${year}`
}

/**
 * 时间跃迁舱
 *
 * 滑轨与读数沿用 A 的设计；下面的「历史锚点」列表是我们原来的设计：
 * 只显示当前朝代的事件，不混入其他朝代。
 */
export default function Timeline({
  dynasties,
  selectedIndex,
  onSelect,
  onOpenEvent,
  title,
  hint,
}) {
  const selectedDynasty = dynasties[selectedIndex] || dynasties[0]
  if (!selectedDynasty) return null

  const range = `${shortYear(selectedDynasty.yearStart)} — ${shortYear(selectedDynasty.yearEnd)}`

  const handleWheel = (event) => {
    if (Math.abs(event.deltaY) < 8) return
    const direction = event.deltaY > 0 ? 1 : -1
    const nextIndex = Math.max(0, Math.min(dynasties.length - 1, selectedIndex + direction))
    if (nextIndex !== selectedIndex) onSelect(nextIndex)
  }

  return (
    <aside className="timeline" aria-label="历史时间轴">
      <div className="timeline__heading">
        <p className="top-bar__tag">TEMPORAL TRANSIT</p>
        <h2>{title}</h2>
        <p>{hint}</p>
      </div>

      <div className="timeline__body">
        {/* A 的时间轴滑轨 */}
        <div className="timeline__slider">
          <span>{String(selectedIndex + 1).padStart(2, '0')}</span>
          <input
            type="range"
            min="0"
            max={dynasties.length - 1}
            step="1"
            value={selectedIndex}
            aria-label="时间轴滑动控制"
            aria-valuenow={selectedIndex}
            aria-valuetext={`${selectedDynasty.dynasty}，${range}`}
            onChange={(event) => onSelect(Number(event.target.value))}
            onWheel={handleWheel}
          />
          <span>{String(dynasties.length).padStart(2, '0')}</span>
          <small>滑动</small>
        </div>

        {/* 当前朝代读数 */}
        <div className="timeline__current" data-testid="timeline-current">
          <span>{range}</span>
          <strong>{selectedDynasty.dynasty}</strong>
          <small>{selectedDynasty.heading}</small>
        </div>

        {/* 我们的设计：该朝代的历史锚点 */}
        <div className="event-list">
          <p className="timeline-node__era">
            历史锚点 / {selectedDynasty.events.length} 处
          </p>
          {selectedDynasty.events.map((event) => (
            <button
              key={event.id}
              type="button"
              className="event-card"
              style={{ '--dynasty-color': selectedDynasty.color }}
              onClick={() => onOpenEvent(event)}
              aria-label={`打开${event.title}历史锚点`}
            >
              <span className="event-card__dot" aria-hidden="true" />
              <span className="event-card__main">
                <strong>{event.title}</strong>
                <small>
                  {formatYear(event.year)} · {event.locationName}
                </small>
              </span>
              <span className="event-card__arrow" aria-hidden="true">›</span>
            </button>
          ))}
        </div>
      </div>
    </aside>
  )
}
