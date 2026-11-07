import { useEffect, useMemo, useRef, useState } from 'react'
import appCopy from './data/appCopy.json'
import { historicalMaps } from './data/historicalMaps.js'
import { getHealth, recordChoice } from './data/apiClient.js'
import mockData from './data/mockData.json'
import CharacterGraphModal from '../../ui/components/CharacterGraphModal.jsx'
import GlobeStage from '../../ui/components/GlobeStage.jsx'
import IntroScreen from '../../ui/components/IntroScreen.jsx'
import LandingScene from '../../ui/components/LandingScene.jsx'
import Timeline from '../../ui/components/Timeline.jsx'

export default function App() {
  const [hasEntered, setHasEntered] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [activeEvent, setActiveEvent] = useState(null)
  const [isRelationsOpen, setIsRelationsOpen] = useState(false)
  const [feedback, setFeedback] = useState('idle')
  const [dbStatus, setDbStatus] = useState('MOCK · 本地数据')
  const returnFocusRef = useRef(null)
  const relationsReturnFocusRef = useRef(null)

  useEffect(() => {
    let cancelled = false
    getHealth()
      .then((health) => {
        if (cancelled || !health) return
        setDbStatus(health.engine === 'sqlite' ? 'DB · SQLite 在线' : 'DB · JSON 在线')
      })
      .catch(() => {})
    return () => { cancelled = true }
  }, [])

  const selectedDynasty = mockData[selectedIndex]
  const eventPoints = useMemo(
    () =>
      selectedDynasty.events.map((event) => ({
        ...event,
        color: selectedDynasty.color,
        dynasty: selectedDynasty.dynasty,
      })),
    [selectedDynasty],
  )

  useEffect(() => {
    if (!activeEvent && !isRelationsOpen) return undefined

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        if (isRelationsOpen) {
          relationsReturnFocusRef.current?.focus()
          setIsRelationsOpen(false)
        }
        returnFocusRef.current?.focus()
        setActiveEvent(null)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [activeEvent, isRelationsOpen])

  useEffect(() => {
    if (!isRelationsOpen) return undefined
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [isRelationsOpen])

  const selectDynasty = (index) => {
    setSelectedIndex(index)
    setFeedback('idle')
  }

  const chooseOption = (option) => {
    setFeedback(option.tone)
  }

  const recordEventChoice = (option, index, currentEvent) => {
    chooseOption(option)
    recordChoice({
      eventId: currentEvent.id,
      eventTitle: currentEvent.title,
      optionIndex: index,
      optionText: option.text,
      tone: option.tone,
      dynasty: selectedDynasty.dynasty,
    }).catch(() => {})
  }

  const openEvent = (event) => {
    returnFocusRef.current = document.activeElement
    setActiveEvent(event)
  }

  const closeEvent = () => {
    returnFocusRef.current?.focus()
    setActiveEvent(null)
  }

  const openRelations = () => {
    relationsReturnFocusRef.current = document.activeElement
    setIsRelationsOpen(true)
  }

  const closeRelations = () => {
    relationsReturnFocusRef.current?.focus()
    setIsRelationsOpen(false)
  }

  if (!hasEntered) {
    return <IntroScreen copy={appCopy} onEnter={() => setHasEntered(true)} />
  }

  return (
    <main
      className={`history-hub history-hub--${feedback}`}
      data-testid="timeline-feedback"
      data-state={feedback}
    >
      <div
        className="glitch-burst"
        data-testid="glitch-burst"
        key={selectedIndex}
        style={{ '--glitch-color': selectedDynasty.color }}
        aria-hidden="true"
      />
      <header className="top-bar">
        <div>
          <p className="top-bar__tag">{appCopy.systemTag}</p>
          <h1>时空跃迁：历史枢纽</h1>
        </div>
        <div className="top-bar__actions">
          <p className="top-bar__host">{appCopy.currentHost}</p>
          <button
            className="relation-entry"
            type="button"
            aria-label={`打开${selectedDynasty.dynasty}历史人物关系图`}
            onClick={openRelations}
          >
            <span className="relation-entry__icon" aria-hidden="true">
              <i />
              <i />
              <i />
            </span>
            <span>
              <small>人物关系</small>
              <strong>关系星图</strong>
            </span>
          </button>
        </div>
      </header>

      <div className="hub-grid">
        <GlobeStage
          points={eventPoints}
          selectedDynasty={selectedDynasty}
          historicalMap={historicalMaps[selectedDynasty.mapKey]}
          onPointClick={openEvent}
          dbStatus={dbStatus}
        />
        <Timeline
          dynasties={mockData}
          selectedIndex={selectedIndex}
          onSelect={selectDynasty}
          onOpenEvent={openEvent}
          title={appCopy.timelineTitle}
          hint={appCopy.timelineHint}
        />
      </div>

      <footer className="system-footer" aria-label="系统状态">
        <span>TIMELINE: STABLE</span>
        <span>{selectedDynasty.dynasty} / {selectedDynasty.events[0].locationName}</span>
        <span>NODE 03 / LINKED</span>
      </footer>

      {activeEvent ? (
        <LandingScene
          event={activeEvent}
          dynasty={selectedDynasty}
          onClose={closeEvent}
          onRecordChoice={recordEventChoice}
        />
      ) : null}

      {isRelationsOpen ? (
        <CharacterGraphModal dynasty={selectedDynasty} onClose={closeRelations} />
      ) : null}
    </main>
  )
}

