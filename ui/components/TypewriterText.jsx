import { useEffect, useState } from 'react'

export default function TypewriterText({ text, speed = 22, className = '' }) {
  const [visibleLength, setVisibleLength] = useState(1)

  useEffect(() => {
    setVisibleLength(1)
  }, [text])

  useEffect(() => {
    if (visibleLength >= text.length) return undefined

    const timer = window.setTimeout(() => {
      setVisibleLength((length) => Math.min(length + 1, text.length))
    }, speed)

    return () => window.clearTimeout(timer)
  }, [speed, text.length, visibleLength])

  return (
    <span
      aria-label={text}
      className={className}
      data-testid="typewriter-text"
    >
      {text.slice(0, visibleLength)}
      <span className="typewriter-caret" aria-hidden="true" />
    </span>
  )
}

