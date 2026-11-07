import { useEffect, useMemo, useRef, useState } from 'react'

function getNodePosition(index, total) {
  if (index === 0) return { left: 50, top: 50 }

  const angle = -Math.PI / 2 + ((index - 1) * Math.PI * 2) / (total - 1)
  return {
    left: 50 + Math.cos(angle) * 37,
    top: 50 + Math.sin(angle) * 37,
  }
}

export default function CharacterGraphModal({ dynasty, onClose }) {
  const [selectedId, setSelectedId] = useState(dynasty.people[0].id)
  const dialogRef = useRef(null)
  const closeButtonRef = useRef(null)

  const positions = useMemo(
    () => new Map(dynasty.people.map((person, index) => [person.id, getNodePosition(index, dynasty.people.length)])),
    [dynasty],
  )
  const selectedPerson = dynasty.people.find((person) => person.id === selectedId) ?? dynasty.people[0]
  const selectedRelations = dynasty.relations
    .filter((relation) => relation.source === selectedPerson.id || relation.target === selectedPerson.id)
    .map((relation) => {
      const relatedId = relation.source === selectedPerson.id ? relation.target : relation.source
      return {
        ...relation,
        person: dynasty.people.find((person) => person.id === relatedId),
      }
    })

  useEffect(() => {
    closeButtonRef.current?.focus()
  }, [])

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return undefined

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.stopPropagation()
        onClose()
        return
      }
      if (event.key !== 'Tab') return

      const focusableElements = Array.from(
        dialog.querySelectorAll('button:not([disabled]), [tabindex]:not([tabindex="-1"])'),
      )
      const firstElement = focusableElements[0]
      const lastElement = focusableElements[focusableElements.length - 1]

      if (event.shiftKey && document.activeElement === firstElement) {
        event.preventDefault()
        lastElement.focus()
      } else if (!event.shiftKey && document.activeElement === lastElement) {
        event.preventDefault()
        firstElement.focus()
      }
    }

    dialog.addEventListener('keydown', handleKeyDown)
    return () => dialog.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  return (
    <div className="character-graph-backdrop" onMouseDown={onClose}>
      <section
        className="character-graph"
        role="dialog"
        aria-modal="true"
        aria-label={`${dynasty.dynasty}人物关系星图`}
        ref={dialogRef}
        style={{ '--graph-accent': dynasty.color }}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="character-graph__stars" aria-hidden="true" />
        <header className="character-graph__header">
          <div>
            <p>TEMPORAL RELATION ARCHIVE / {dynasty.dynasty}</p>
            <h2>人物关系星图</h2>
            <span>{dynasty.heading}</span>
          </div>
          <button
            type="button"
            className="system-modal__close"
            aria-label="关闭人物关系图"
            onClick={onClose}
            ref={closeButtonRef}
          >
            ×
          </button>
        </header>

        <div className="character-graph__body">
          <div className="character-graph__canvas">
            <div className="character-graph__orbit" aria-hidden="true" />
            <svg
              className="character-graph__links"
              viewBox="0 0 100 100"
              preserveAspectRatio="none"
              aria-hidden="true"
            >
              {dynasty.relations.map((relation) => {
                const source = positions.get(relation.source)
                const target = positions.get(relation.target)
                const isSelected =
                  relation.source === selectedPerson.id || relation.target === selectedPerson.id
                return (
                  <line
                    key={`${relation.source}-${relation.target}`}
                    x1={source.left}
                    y1={source.top}
                    x2={target.left}
                    y2={target.top}
                    className={isSelected ? 'is-selected' : ''}
                  />
                )
              })}
            </svg>

            {dynasty.people.map((person) => {
              const position = positions.get(person.id)
              const isSelected = person.id === selectedPerson.id
              return (
                <button
                  key={person.id}
                  type="button"
                  className={`character-node ${isSelected ? 'character-node--active' : ''}`}
                  style={{ left: `${position.left}%`, top: `${position.top}%` }}
                  aria-pressed={isSelected}
                  aria-label={`${person.name}，${person.role}`}
                  onClick={() => setSelectedId(person.id)}
                >
                  <span className="character-node__halo" aria-hidden="true" />
                  <strong>{person.name}</strong>
                  <small>{person.role}</small>
                </button>
              )
            })}
          </div>

          <aside className="character-profile" data-testid="character-profile" aria-live="polite">
            <p className="character-profile__eyebrow">PERSONNEL RECORD</p>
            <span className="character-profile__role">{selectedPerson.role}</span>
            <h3>{selectedPerson.name}</h3>
            <p className="character-profile__bio">{selectedPerson.bio}</p>
            <div className="character-profile__relations">
              <h4>关联人物</h4>
              {selectedRelations.map((relation) => (
                <div key={`${relation.source}-${relation.target}`}>
                  <strong>{relation.person.name}</strong>
                  <span>{relation.label}</span>
                </div>
              ))}
            </div>
          </aside>
        </div>

        <footer className="character-graph__footer">
          <span>{dynasty.people.length} 人物节点</span>
          <span>{dynasty.relations.length} 条历史关系</span>
          <span>选择人物以追踪关系链</span>
        </footer>
      </section>
    </div>
  )
}

