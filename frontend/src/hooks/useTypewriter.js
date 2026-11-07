import { useEffect, useRef, useState } from 'react';

/** 逐字打字机：开场白用 */
export function useTypewriter(text = '', speed = 42) {
  const [output, setOutput] = useState('');
  const [done, setDone] = useState(false);
  const timerRef = useRef(null);

  useEffect(() => {
    const value = String(text ?? '');
    if (timerRef.current) window.clearInterval(timerRef.current);
    if (!value) {
      setOutput('');
      setDone(true);
      return undefined;
    }

    setOutput('');
    setDone(false);
    let cursor = 0;
    timerRef.current = window.setInterval(() => {
      cursor += 1;
      setOutput(value.slice(0, cursor));
      if (cursor >= value.length) {
        window.clearInterval(timerRef.current);
        timerRef.current = null;
        setDone(true);
      }
    }, speed);

    return () => {
      if (timerRef.current) window.clearInterval(timerRef.current);
      timerRef.current = null;
    };
  }, [text, speed]);

  const skip = () => {
    if (timerRef.current) window.clearInterval(timerRef.current);
    timerRef.current = null;
    setOutput(String(text ?? ''));
    setDone(true);
  };

  return { output, done, skip };
}
