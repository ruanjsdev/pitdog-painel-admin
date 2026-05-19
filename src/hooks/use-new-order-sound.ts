import { useCallback, useEffect, useRef, useState } from "react"

import type { Order } from "../types/order"

type UseNewOrderSoundOptions = {
  enabled: boolean
  soundUrl?: string
}

const defaultSoundUrl = "/sounds/new-order.mp3"
const initialSnapshotDelay = 1500

export function useNewOrderSound(
  orders: Order[],
  { enabled, soundUrl = defaultSoundUrl }: UseNewOrderSoundOptions
) {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const knownOrderIdsRef = useRef<Set<number>>(new Set())
  const isPrimedRef = useRef(false)
  const audioContextRef = useRef<AudioContext | null>(null)
  const [needsActivation, setNeedsActivation] = useState(false)
  const [isReady, setIsReady] = useState(false)

  useEffect(() => {
    const audio = new Audio(soundUrl)

    audio.preload = "auto"
    audio.volume = 0.78
    audioRef.current = audio

    return () => {
      audio.pause()
      audioRef.current = null
    }
  }, [soundUrl])

  const playFallbackTone = useCallback(() => {
    const AudioContextConstructor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext

    if (!AudioContextConstructor) return

    const context = audioContextRef.current ?? new AudioContextConstructor()
    audioContextRef.current = context

    const oscillator = context.createOscillator()
    const gain = context.createGain()

    oscillator.type = "sine"
    oscillator.frequency.setValueAtTime(880, context.currentTime)
    oscillator.frequency.exponentialRampToValueAtTime(1320, context.currentTime + 0.12)
    gain.gain.setValueAtTime(0.0001, context.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.18, context.currentTime + 0.02)
    gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.28)

    oscillator.connect(gain)
    gain.connect(context.destination)
    oscillator.start()
    oscillator.stop(context.currentTime + 0.3)
  }, [])

  const playNotification = useCallback(async () => {
    if (!enabled) return

    const audio = audioRef.current

    if (!audio) {
      playFallbackTone()
      return
    }

    try {
      audio.currentTime = 0
      await audio.play()
      setNeedsActivation(false)
      setIsReady(true)
    } catch (error) {
      if (error instanceof DOMException && error.name === "NotAllowedError") {
        setNeedsActivation(true)
        setIsReady(false)
        return
      }

      playFallbackTone()
      setNeedsActivation(false)
      setIsReady(true)
    }
  }, [enabled, playFallbackTone])

  const activateSound = useCallback(async () => {
    const audio = audioRef.current

    try {
      if (audio) {
        const previousVolume = audio.volume

        audio.volume = 0
        await audio.play()
        audio.pause()
        audio.currentTime = 0
        audio.volume = previousVolume
      } else {
        playFallbackTone()
      }

      if (audioContextRef.current?.state === "suspended") {
        await audioContextRef.current.resume()
      }

      setNeedsActivation(false)
      setIsReady(true)
    } catch {
      try {
        playFallbackTone()
        setNeedsActivation(false)
        setIsReady(true)
      } catch {
        setNeedsActivation(true)
        setIsReady(false)
      }
    }
  }, [playFallbackTone])

  useEffect(() => {
    const currentIds = new Set(orders.map((order) => order.backendId ?? order.id))

    if (!isPrimedRef.current) {
      if (orders.length > 0) {
        knownOrderIdsRef.current = currentIds
        isPrimedRef.current = true
        return
      }

      const timer = window.setTimeout(() => {
        if (!isPrimedRef.current) {
          knownOrderIdsRef.current = currentIds
          isPrimedRef.current = true
        }
      }, initialSnapshotDelay)

      return () => window.clearTimeout(timer)
    }

    const hasNewOrder = [...currentIds].some((id) => !knownOrderIdsRef.current.has(id))

    knownOrderIdsRef.current = currentIds

    if (hasNewOrder) {
      void playNotification()
    }
  }, [orders, playNotification])

  return {
    activateSound,
    isReady,
    needsActivation,
  }
}
