import { useCallback, useEffect, useRef, useState } from "react"

import type { Order } from "../types/order"

type UseNewOrderSoundOptions = {
  enabled: boolean
  soundModeId?: NewOrderSoundModeId
}

const soundsBaseUrl = `${import.meta.env.BASE_URL}sounds/`

export const newOrderSoundModes = [
  { description: "Som atual do painel", file: "new-order.mp3", id: "padrao", name: "Padrão" },
  { description: "Campainha limpa para pedido novo", file: "alert-bell.mp3", id: "duplo", name: "Campainha" },
  { description: "Pop curto de notificação", file: "alert-pop.mp3", id: "subida", name: "Pop pedido" },
  { description: "Abertura curta de sistema", file: "alert-start.mp3", id: "grave", name: "Sistema" },
  { description: "Sininhos alegres, bom para balcão", file: "alert-happy-bells.mp3", id: "campainha", name: "Sinos" },
  { description: "Confirmação curta e objetiva", file: "alert-confirmation.mp3", id: "digital", name: "Confirmação" },
  { description: "Alerta claro para cozinha", file: "alert-announce.mp3", id: "alerta", name: "Anúncio" },
  { description: "Tom simples e urgente", file: "alert-urgent-loop.mp3", id: "suave", name: "Urgente" },
  { description: "Campainha de porta, bem reconhecível", file: "alert-doorbell.mp3", id: "caixa", name: "Porta" },
  { description: "Toque digital rápido", file: "alert-digital.mp3", id: "cozinha", name: "Digital" },
] as const

export type NewOrderSoundModeId = typeof newOrderSoundModes[number]["id"]

const fallbackSoundModeId: NewOrderSoundModeId = "padrao"
const repeatIntervals: Record<NewOrderSoundModeId, number> = {
  alerta: 5200,
  caixa: 4200,
  campainha: 4600,
  cozinha: 4100,
  digital: 3800,
  duplo: 4200,
  grave: 3800,
  padrao: 4200,
  suave: 5200,
  subida: 3600,
}

function isNewOrderSoundModeId(value: string): value is NewOrderSoundModeId {
  return newOrderSoundModes.some((mode) => mode.id === value)
}

function getSoundMode(modeId: NewOrderSoundModeId) {
  return newOrderSoundModes.find((mode) => mode.id === modeId) ?? newOrderSoundModes[0]
}

function getOrderSoundIds(order: Pick<Order, "backendId" | "id">) {
  return [order.backendId, order.id].filter((id): id is number => typeof id === "number")
}

export function normalizeNewOrderSoundModeId(value?: string | null): NewOrderSoundModeId {
  return value && isNewOrderSoundModeId(value) ? value : fallbackSoundModeId
}

export function useNewOrderSound(
  orders: Order[],
  { enabled, soundModeId = fallbackSoundModeId }: UseNewOrderSoundOptions
) {
  const knownOrderIdsRef = useRef<Set<number>>(new Set())
  const isPrimedRef = useRef(false)
  const isPlayingRef = useRef(false)
  const activationAttemptedRef = useRef(false)
  const audioContextRef = useRef<AudioContext | null>(null)
  const audioByModeRef = useRef<Map<NewOrderSoundModeId, HTMLAudioElement>>(new Map())
  const [unacknowledgedOrderIds, setUnacknowledgedOrderIds] = useState<Set<number>>(new Set())
  const [needsActivation, setNeedsActivation] = useState(false)
  const [isReady, setIsReady] = useState(false)

  useEffect(() => {
    const audioByMode = new Map<NewOrderSoundModeId, HTMLAudioElement>()

    newOrderSoundModes.forEach((mode) => {
      const audio = new Audio(`${soundsBaseUrl}${mode.file}`)

      audio.preload = "auto"
      audio.volume = 0.82
      audioByMode.set(mode.id, audio)
    })

    audioByModeRef.current = audioByMode

    return () => {
      audioByMode.forEach((audio) => {
        audio.pause()
      })
      audioByModeRef.current = new Map()
    }
  }, [])

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
    oscillator.frequency.exponentialRampToValueAtTime(1180, context.currentTime + 0.16)
    gain.gain.setValueAtTime(0.0001, context.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.12, context.currentTime + 0.02)
    gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.34)
    oscillator.connect(gain)
    gain.connect(context.destination)
    oscillator.start()
    oscillator.stop(context.currentTime + 0.36)
  }, [])

  const playSoundMode = useCallback(async (modeId: NewOrderSoundModeId, muted = false) => {
    const mode = getSoundMode(modeId)
    const audio = audioByModeRef.current.get(mode.id) ?? new Audio(`${soundsBaseUrl}${mode.file}`)

    audio.pause()
    audio.currentTime = 0
    audio.volume = muted ? 0 : 0.82

    await audio.play()
  }, [])

  const unlockSound = useCallback(async () => {
    if (!enabled || activationAttemptedRef.current) return

    activationAttemptedRef.current = true

    try {
      await playSoundMode(soundModeId, true)

      if (audioContextRef.current?.state === "suspended") {
        await audioContextRef.current.resume()
      }

      setNeedsActivation(false)
      setIsReady(true)
    } catch {
      setNeedsActivation(true)
      setIsReady(false)
      activationAttemptedRef.current = false
    }
  }, [enabled, playSoundMode, soundModeId])

  const playNotification = useCallback(async () => {
    if (!enabled || isPlayingRef.current) {
      return
    }

    isPlayingRef.current = true

    try {
      await playSoundMode(soundModeId)
      setNeedsActivation(false)
      setIsReady(true)
    } catch (error) {
      if (error instanceof DOMException && error.name === "NotAllowedError") {
        setNeedsActivation(true)
        setIsReady(false)
        isPlayingRef.current = false
        return
      }

      playFallbackTone()
      setNeedsActivation(false)
      setIsReady(true)
    } finally {
      isPlayingRef.current = false
    }
  }, [enabled, playFallbackTone, playSoundMode, soundModeId])

  const activateSound = useCallback(async () => {
    try {
      activationAttemptedRef.current = true
      await playSoundMode(soundModeId, true)

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
  }, [playFallbackTone, playSoundMode, soundModeId])

  useEffect(() => {
    if (!enabled || isReady) return

    const handleUserGesture = () => {
      void unlockSound()
    }

    window.addEventListener("click", handleUserGesture, { once: true })
    window.addEventListener("keydown", handleUserGesture, { once: true })
    window.addEventListener("pointerdown", handleUserGesture, { once: true })
    window.addEventListener("touchstart", handleUserGesture, { once: true })

    return () => {
      window.removeEventListener("click", handleUserGesture)
      window.removeEventListener("keydown", handleUserGesture)
      window.removeEventListener("pointerdown", handleUserGesture)
      window.removeEventListener("touchstart", handleUserGesture)
    }
  }, [enabled, isReady, unlockSound])

  const previewSound = useCallback((modeId: NewOrderSoundModeId) => {
    void playSoundMode(modeId).catch(() => {
      playFallbackTone()
    })
  }, [playFallbackTone, playSoundMode])

  const stopAllSounds = useCallback(() => {
    audioByModeRef.current.forEach((audio) => {
      audio.pause()
      audio.currentTime = 0
    })
    isPlayingRef.current = false
  }, [])

  const acknowledgeOrder = useCallback((order: Pick<Order, "backendId" | "id">) => {
    const orderIds = getOrderSoundIds(order)

    setUnacknowledgedOrderIds((currentIds) => {
      if (!orderIds.some((orderId) => currentIds.has(orderId))) return currentIds

      const nextIds = new Set(currentIds)

      orderIds.forEach((orderId) => nextIds.delete(orderId))

      if (nextIds.size === 0) {
        stopAllSounds()
      }

      return nextIds
    })
  }, [stopAllSounds])

  useEffect(() => {
    const currentIds = new Set(orders.map((order) => order.backendId ?? order.id))

    setUnacknowledgedOrderIds((currentIdsSet) => {
      const nextIds = new Set([...currentIdsSet].filter((id) => currentIds.has(id)))

      return nextIds.size === currentIdsSet.size ? currentIdsSet : nextIds
    })

    if (!isPrimedRef.current) {
      knownOrderIdsRef.current = currentIds
      isPrimedRef.current = true
      return
    }

    const newIds = [...currentIds].filter((id) => !knownOrderIdsRef.current.has(id))

    knownOrderIdsRef.current = currentIds

    if (newIds.length > 0) {
      setUnacknowledgedOrderIds((currentIdsSet) => new Set([...currentIdsSet, ...newIds]))
      void playNotification()
    }
  }, [orders, playNotification])

  useEffect(() => {
    if (!enabled || unacknowledgedOrderIds.size === 0) return

    const timer = window.setInterval(() => {
      void playNotification()
    }, repeatIntervals[soundModeId])

    return () => window.clearInterval(timer)
  }, [enabled, playNotification, soundModeId, unacknowledgedOrderIds])

  return {
    acknowledgeOrder,
    activateSound,
    isReady,
    needsActivation,
    previewSound,
    unacknowledgedOrderIds,
  }
}
