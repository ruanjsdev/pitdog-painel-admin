import { useEffect, useRef, useState } from "react"
import type { LucideIcon } from "lucide-react"
import {
  Bell,
  Check,
  ChevronDown,
  ExternalLink,
  LogOut,
  Moon,
  PanelTop,
  Play,
  Power,
  Printer,
  Bike,
  Settings,
  ShieldCheck,
  Store,
  UserRound,
  Volume2,
  VolumeX,
} from "lucide-react"

import { ConnectionStatusBadge } from "./dashboard-status-badges"
import type { NewOrderSoundModeId } from "../../hooks/use-new-order-sound"

const logoUrl = `${import.meta.env.BASE_URL}LogoPitis.png`
const panelSettingsStorageKey = "pitsdog:admin:panel-settings:v1"

type ConnectionStatus = "not-configured" | "offline" | "online"
type PanelSettings = {
  compactNavigation: boolean
  confirmLogout: boolean
  quietMode: boolean
}
type LocalPanelSettings = {
  autoPrint: boolean
  compactMode: boolean
  defaultDeliveryFee: number
  printCopies: number
}
type SoundMode = {
  description: string
  id: NewOrderSoundModeId
  name: string
}

type NavigationItem = {
  description: string
  icon: LucideIcon
  label: string
  value: string
}

const defaultPanelSettings: PanelSettings = {
  compactNavigation: false,
  confirmLogout: true,
  quietMode: false,
}

function readPanelSettings() {
  try {
    const storedSettings = window.localStorage.getItem(panelSettingsStorageKey)

    if (!storedSettings) return defaultPanelSettings

    return {
      ...defaultPanelSettings,
      ...JSON.parse(storedSettings),
    } as PanelSettings
  } catch {
    return defaultPanelSettings
  }
}

type Props = {
  activePanel: string
  backendReady: boolean
  connectionStatus: ConnectionStatus
  isSyncing: boolean
  localPanelSettings: LocalPanelSettings
  navigationItems: readonly NavigationItem[]
  notice: string
  onActivateSound: () => Promise<void>
  onLogout: () => void
  onNotice: (message: string) => void
  onPreviewSound: (modeId: NewOrderSoundModeId) => void
  onShowPanel: (panel: string) => void
  onSoundModeChange: (modeId: NewOrderSoundModeId) => void
  onToggleStore: (open: boolean) => Promise<boolean>
  orderSoundNeedsActivation: boolean
  setSoundEnabled: (getNextValue: (value: boolean) => boolean) => void
  setLocalPanelSettings: (getNextValue: (settings: LocalPanelSettings) => LocalPanelSettings) => void
  setStoreOpen: (open: boolean) => void
  soundEnabled: boolean
  soundModeId: NewOrderSoundModeId
  soundModes: readonly SoundMode[]
  storeOpen: boolean
}

export function DashboardHeader({
  activePanel,
  backendReady,
  connectionStatus,
  isSyncing,
  localPanelSettings,
  navigationItems,
  notice,
  onActivateSound,
  onLogout,
  onNotice,
  onPreviewSound,
  onShowPanel,
  onSoundModeChange,
  onToggleStore,
  orderSoundNeedsActivation,
  setSoundEnabled,
  setLocalPanelSettings,
  setStoreOpen,
  soundEnabled,
  soundModeId,
  soundModes,
  storeOpen,
}: Props) {
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [soundPickerOpen, setSoundPickerOpen] = useState(false)
  const [draftSoundModeId, setDraftSoundModeId] = useState(soundModeId)
  const [panelSettings, setPanelSettings] = useState<PanelSettings>(readPanelSettings)
  const [storeStatusSaving, setStoreStatusSaving] = useState(false)
  const settingsMenuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    window.localStorage.setItem(panelSettingsStorageKey, JSON.stringify(panelSettings))
  }, [panelSettings])

  useEffect(() => {
    if (!settingsOpen) {
      setSoundPickerOpen(false)
    }
  }, [settingsOpen])

  useEffect(() => {
    if (!soundPickerOpen) {
      setDraftSoundModeId(soundModeId)
    }
  }, [soundModeId, soundPickerOpen])

  useEffect(() => {
    if (!settingsOpen) return

    function handleClickOutside(event: MouseEvent) {
      if (!settingsMenuRef.current?.contains(event.target as Node)) {
        setSettingsOpen(false)
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setSettingsOpen(false)
      }
    }

    document.addEventListener("mousedown", handleClickOutside)
    document.addEventListener("keydown", handleEscape)

    return () => {
      document.removeEventListener("mousedown", handleClickOutside)
      document.removeEventListener("keydown", handleEscape)
    }
  }, [settingsOpen])

  function updatePanelSetting<Key extends keyof PanelSettings>(key: Key, value: PanelSettings[Key]) {
    setPanelSettings((currentSettings) => ({
      ...currentSettings,
      [key]: value,
    }))
  }

  function updateLocalPanelSetting<Key extends keyof LocalPanelSettings>(key: Key, value: LocalPanelSettings[Key]) {
    setLocalPanelSettings((currentSettings) => ({
      ...currentSettings,
      [key]: value,
    }))
  }

  function handleLogout() {
    if (panelSettings.confirmLogout && !window.confirm("Sair do painel administrativo?")) return

    onLogout()
  }

  function openSoundPicker() {
    setDraftSoundModeId(soundModeId)
    setSoundPickerOpen(true)
  }

  function confirmSoundMode() {
    onSoundModeChange(draftSoundModeId)
    setSoundPickerOpen(false)
    onNotice(`Som de pedidos alterado para ${soundModes.find((mode) => mode.id === draftSoundModeId)?.name ?? "Padrão"}.`)
  }

  async function toggleStoreOpen() {
    if (storeStatusSaving) return

    const nextStoreOpen = !storeOpen
    setStoreStatusSaving(true)

    const updated = await onToggleStore(nextStoreOpen)

    if (updated) {
      setStoreOpen(nextStoreOpen)
      onNotice(nextStoreOpen ? "Loja aberta para novos pedidos." : "Loja fechada para novos pedidos.")
    } else {
      onNotice("Não foi possível alterar o estado da loja agora.")
    }

    setStoreStatusSaving(false)
  }

  return (
    <header className={`shrink-0 rounded-lg border px-3 py-3 shadow-[0_20px_60px_rgba(0,0,0,0.28)] backdrop-blur-xl sm:px-4 ${
      storeOpen
        ? "border-white/10 bg-[rgba(18,11,7,0.92)]"
        : "border-red-300/30 bg-[rgba(75,14,14,0.92)]"
    }`}>
      <div className="flex flex-col gap-3 2xl:flex-row 2xl:items-center 2xl:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <img
            src={logoUrl}
            alt="Pits Dog"
            className="dashboard-logo shrink-0 drop-shadow-[0_0_18px_rgba(255,106,0,0.42)]"
          />
          <div className="min-w-0">
            <p className="text-[11px] font-black uppercase tracking-[0.18em] text-orange-300">
              Pits em ação
            </p>
            <h1 className="truncate text-xl font-black text-white sm:text-2xl">Central de pedidos</h1>
            <p className={`mt-0.5 truncate text-xs ${storeOpen ? "text-zinc-500" : "text-red-100/70"}`}>{notice}</p>
          </div>
        </div>

        <nav className="flex min-w-0 flex-1 justify-center" aria-label="Navegação principal">
          <div className="grid w-full max-w-[900px] grid-cols-2 gap-2 rounded-lg border border-white/10 bg-black/[0.22] p-1 sm:grid-cols-3 lg:grid-cols-5">
          {navigationItems.map((item) => {
            const Icon = item.icon
            const isActive = activePanel === item.value

            return (
              <button
                key={item.value}
                type="button"
                onClick={() => onShowPanel(item.value)}
                className={`flex min-w-0 items-center gap-2 rounded-lg px-2 text-left transition ${
                  isActive
                    ? "bg-orange-400 text-black shadow-[0_14px_32px_rgba(255,106,0,0.22)]"
                    : "text-zinc-300 hover:bg-white/[0.07] hover:text-white"
                } ${panelSettings.compactNavigation ? "min-h-10" : "min-h-12"}`}
              >
                <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg ${
                  isActive ? "bg-black/15" : "bg-white/[0.06]"
                }`}>
                  <Icon size={17} />
                </span>
                <span className="min-w-0">
                  <strong className="block text-sm font-black">{item.label}</strong>
                  {!panelSettings.compactNavigation && (
                    <span className={`block truncate text-[11px] font-bold ${isActive ? "text-black/65" : "text-zinc-500"}`}>
                      {item.description}
                    </span>
                  )}
                </span>
              </button>
            )
          })}
          </div>
        </nav>

        <div className="grid w-full grid-cols-[minmax(0,1fr)_40px_40px] items-center gap-2 rounded-lg border border-white/10 bg-black/[0.18] p-1 sm:flex sm:w-auto sm:flex-wrap sm:border-0 sm:bg-transparent sm:p-0">
          <ConnectionStatusBadge
            connectionStatus={connectionStatus}
            isSyncing={isSyncing}
          />
          <button
            className="grid h-10 w-10 place-items-center rounded-lg border border-white/10 bg-white/5 text-white transition hover:bg-white/10 sm:h-9 sm:w-9"
            type="button"
            onClick={() => onNotice("Notificações conferidas.")}
            aria-label="Notificações"
          >
            <Bell size={16} />
          </button>
          <div className="relative" ref={settingsMenuRef}>
            <button
              type="button"
              onClick={() => setSettingsOpen((value) => !value)}
              className={`inline-flex h-10 w-10 items-center justify-center gap-1 rounded-lg border text-xs font-black transition sm:h-9 sm:w-auto sm:px-2.5 ${
                settingsOpen
                  ? "border-orange-300/45 bg-orange-400/15 text-orange-100"
                  : "border-white/10 bg-white/5 text-white hover:bg-white/10"
              }`}
              aria-expanded={settingsOpen}
              aria-haspopup="menu"
              aria-label="Configurações do painel"
            >
              <UserRound size={16} />
              <ChevronDown className="hidden sm:block" size={14} />
            </button>

            {settingsOpen && (
              <div
                className="fixed left-2 right-2 top-24 z-50 max-h-[calc(100dvh-112px)] overflow-y-auto rounded-lg border border-white/10 bg-[#100b08] shadow-[0_28px_70px_rgba(0,0,0,0.58)] sm:absolute sm:left-auto sm:right-0 sm:top-11 sm:w-[min(92vw,360px)] sm:max-h-[calc(100vh-96px)]"
                role="menu"
              >
                {soundPickerOpen ? (
                  <div>
                    <div className="border-b border-white/10 bg-orange-400/[0.08] px-4 py-3">
                      <p className="text-[11px] font-black uppercase tracking-[0.16em] text-orange-300">Trocar som</p>
                      <h3 className="mt-1 text-lg font-black text-white">Escolha o alerta</h3>
                    </div>

                    <div className="max-h-[min(72vh,560px)] overflow-y-auto p-3">
                      <div className="space-y-2">
                        {soundModes.map((mode) => {
                          const selected = draftSoundModeId === mode.id

                          return (
                            <button
                              key={mode.id}
                              type="button"
                              onClick={() => {
                                setDraftSoundModeId(mode.id)
                                onPreviewSound(mode.id)
                              }}
                              className={`flex w-full items-center gap-3 rounded-lg border p-3 text-left transition ${
                                selected
                                  ? "border-orange-300/55 bg-orange-400/15"
                                  : "border-white/10 bg-black/20 hover:bg-white/[0.07]"
                              }`}
                            >
                              <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg ${
                                selected ? "bg-orange-400 text-black" : "bg-white/5 text-zinc-300"
                              }`}>
                                {selected ? <Check size={16} /> : <Volume2 size={16} />}
                              </span>
                              <span className="min-w-0 flex-1">
                                <strong className="block text-sm font-black text-white">{mode.name}</strong>
                                <span className="mt-0.5 block text-xs font-bold text-zinc-500">{mode.description}</span>
                              </span>
                              <span
                                className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-white/10 bg-white/5 text-zinc-300"
                                title="Ouvir prévia"
                              >
                                <Play size={14} />
                              </span>
                            </button>
                          )
                        })}
                      </div>

                      <div className="mt-3 grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => setSoundPickerOpen(false)}
                          className="h-10 rounded-lg border border-white/10 bg-white/5 text-sm font-black text-white transition hover:bg-white/10"
                        >
                          Voltar
                        </button>
                        <button
                          type="button"
                          onClick={confirmSoundMode}
                          className="h-10 rounded-lg bg-orange-400 text-sm font-black text-black transition hover:bg-orange-300"
                        >
                          Pronto
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <>
                <div className="border-b border-white/10 bg-orange-400/[0.08] px-4 py-3">
                  <div className="flex items-center gap-3">
                    <span className="grid h-10 w-10 place-items-center rounded-lg bg-orange-400 text-black">
                      <UserRound size={19} />
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-black text-white">Administrador</p>
                      <p className="truncate text-xs font-bold text-zinc-500">Configurações do painel</p>
                    </div>
                  </div>
                </div>

                <div className="space-y-3 p-3">
                  <div className="rounded-lg border border-white/10 bg-black/20 p-3">
                    <div className="mb-2 flex items-center gap-2 text-xs font-black uppercase tracking-[0.14em] text-orange-300">
                      <Power size={14} />
                      Operação
                    </div>
                    <button
                      type="button"
                      onClick={toggleStoreOpen}
                      disabled={!backendReady || storeStatusSaving}
                      className={`flex w-full items-center justify-between gap-3 rounded-lg border px-3 py-2.5 text-left transition disabled:cursor-not-allowed disabled:opacity-60 ${
                        storeOpen
                          ? "border-emerald-300/25 bg-emerald-400/10 text-emerald-100"
                          : "border-red-300/25 bg-red-400/10 text-red-100"
                      }`}
                      role="menuitem"
                    >
                      <span className="flex min-w-0 items-center gap-2">
                        <Store size={16} />
                        <span>
                          <strong className="block text-sm font-black">Loja {storeOpen ? "aberta" : "fechada"}</strong>
                          <span className="block text-[11px] font-bold opacity-70">
                            {storeStatusSaving ? "Salvando..." : backendReady ? "Alternar recebimento" : "Sinal necessário"}
                          </span>
                        </span>
                      </span>
                      <span className={`h-5 w-9 rounded-full p-0.5 transition ${
                        storeOpen ? "bg-emerald-300/80" : "bg-red-300/70"
                      }`}>
                        <span className={`block h-4 w-4 rounded-full bg-black transition ${
                          storeOpen ? "translate-x-4" : "translate-x-0"
                        }`} />
                      </span>
                    </button>
                    <a
                      className="mt-2 flex w-full items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-sm font-black text-white transition hover:bg-white/10"
                      href="https://pitsdog-cardapio-oficial.onrender.com"
                      target="_blank"
                      rel="noreferrer"
                      role="menuitem"
                    >
                      <ExternalLink size={16} />
                      Abrir cardápio
                    </a>
                    <button
                      type="button"
                      onClick={() => onShowPanel("motoboys")}
                      className="mt-2 flex w-full items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-sm font-black text-white transition hover:bg-white/10"
                      role="menuitem"
                    >
                      <Bike size={16} />
                      <div className="text-left">
                        <strong className="block text-sm">Gerenciar Motoboys</strong>
                      </div>
	                    </button>
	                    <button
	                      type="button"
	                      onClick={() => {
	                        setSettingsOpen(false)
	                        onShowPanel("limpeza")
	                      }}
	                      className="mt-2 flex w-full items-center gap-2 rounded-lg border border-red-300/25 bg-red-400/10 px-3 py-2.5 text-sm font-black text-red-100 transition hover:bg-red-400/[0.18]"
	                      role="menuitem"
	                    >
	                      <ShieldCheck size={16} />
	                      <div className="text-left">
	                        <strong className="block text-sm">Limpeza de pedidos</strong>
	                        <span className="block text-[11px] text-red-100/65">Ocultar testes</span>
	                      </div>
	                    </button>
	                    <button
	                      type="button"
	                      onClick={() => {
	                        setSettingsOpen(false)
	                        onShowPanel("configuracoes")
	                      }}
	                      className="mt-2 flex w-full items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-sm font-black text-white transition hover:bg-white/10"
	                      role="menuitem"
	                    >
	                      <Printer size={16} />
	                      <div className="text-left">
	                        <strong className="block text-sm">Configurações</strong>
	                        <span className="block text-[11px] text-zinc-500">Impressora</span>
	                      </div>
	                    </button>
                    <button
                      type="button"
                      onClick={() => onShowPanel("zap")}
                      className="mt-2 flex w-full items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-sm font-black text-white transition hover:bg-white/10"
                      role="menuitem"
                    >
                      <ExternalLink size={16} />
                      Bot do Zap
                    </button>
                  </div>

                  <div className="rounded-lg border border-white/10 bg-black/20 p-3">
                    <div className="mb-2 flex items-center gap-2 text-xs font-black uppercase tracking-[0.14em] text-orange-300">
                      <Settings size={14} />
                      Preferências
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setSoundEnabled((value) => !value)
                        onNotice(soundEnabled ? "Som de pedidos desativado." : "Som de pedidos ativado.")
                      }}
                      className="flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-black text-white transition hover:bg-white/[0.07]"
                      role="menuitemcheckbox"
                      aria-checked={soundEnabled}
                    >
                      <span className="flex items-center gap-2">
                        {soundEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
                        Som de pedidos
                      </span>
                      {soundEnabled && <Check size={16} className="text-orange-300" />}
                    </button>
                    {soundEnabled && orderSoundNeedsActivation && (
                      <button
                        type="button"
                        onClick={async () => {
                          await onActivateSound()
                          onNotice("Som de pedidos ativado neste navegador.")
                        }}
                        className="mt-1 flex w-full items-center gap-2 rounded-lg bg-orange-400 px-3 py-2.5 text-sm font-black text-black transition hover:bg-orange-300"
                        role="menuitem"
                      >
                        <Volume2 size={16} />
                        Ativar som no navegador
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={openSoundPicker}
                      className="flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-black text-white transition hover:bg-white/[0.07]"
                      role="menuitem"
                    >
                      <span className="flex min-w-0 items-center gap-2">
                        <Settings size={16} />
                        <span className="min-w-0">
                          <span className="block">Trocar som</span>
                          <span className="block truncate text-[11px] font-bold text-zinc-500">
                            {soundModes.find((mode) => mode.id === soundModeId)?.name ?? "Padrão"}
                          </span>
                        </span>
                      </span>
                      <ChevronDown size={14} className="-rotate-90 text-zinc-500" />
                    </button>
                    <div className="my-2 border-t border-white/10 pt-2">
                      <p className="mb-1 px-3 text-[10px] font-black uppercase tracking-[0.14em] text-zinc-500">
                        Impressora
                      </p>
                      <button
                        type="button"
                        onClick={() => updateLocalPanelSetting("autoPrint", !localPanelSettings.autoPrint)}
                        className="flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-black text-white transition hover:bg-white/[0.07]"
                        role="menuitemcheckbox"
                        aria-checked={localPanelSettings.autoPrint}
                      >
                        <span className="flex items-center gap-2">
                          <Printer size={16} />
                          Impressão automática
                        </span>
                        {localPanelSettings.autoPrint && <Check size={16} className="text-orange-300" />}
                      </button>
                      <label className="flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-sm font-black text-white transition hover:bg-white/[0.07]">
                        <span className="flex items-center gap-2">
                          <Printer size={16} />
                          Cópias por comanda
                        </span>
                        <input
                          min={1}
                          max={5}
                          value={localPanelSettings.printCopies}
                          onChange={(event) => updateLocalPanelSetting(
                            "printCopies",
                            Math.max(1, Math.min(5, Number(event.target.value) || 1))
                          )}
                          onClick={(event) => event.stopPropagation()}
                          type="number"
                          className="h-8 w-16 rounded-lg border border-white/10 bg-black/30 px-2 text-center text-xs font-black text-white outline-none focus:border-orange-300/55"
                        />
                      </label>
                      <button
                        type="button"
                        onClick={() => updateLocalPanelSetting("compactMode", !localPanelSettings.compactMode)}
                        className="flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-black text-white transition hover:bg-white/[0.07]"
                        role="menuitemcheckbox"
                        aria-checked={localPanelSettings.compactMode}
                      >
                        <span className="flex items-center gap-2">
                          <PanelTop size={16} />
                          Modo compacto
                        </span>
                        {localPanelSettings.compactMode && <Check size={16} className="text-orange-300" />}
                      </button>
                    </div>
                    <button
                      type="button"
                      onClick={() => updatePanelSetting("compactNavigation", !panelSettings.compactNavigation)}
                      className="flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-black text-white transition hover:bg-white/[0.07]"
                      role="menuitemcheckbox"
                      aria-checked={panelSettings.compactNavigation}
                    >
                      <span className="flex items-center gap-2">
                        <PanelTop size={16} />
                        Navegação compacta
                      </span>
                      {panelSettings.compactNavigation && <Check size={16} className="text-orange-300" />}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const nextQuietMode = !panelSettings.quietMode

                        updatePanelSetting("quietMode", nextQuietMode)
                        setSoundEnabled(() => !nextQuietMode)
                        onNotice(nextQuietMode ? "Modo silencioso ativado." : "Modo silencioso desativado.")
                      }}
                      className="flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-black text-white transition hover:bg-white/[0.07]"
                      role="menuitemcheckbox"
                      aria-checked={panelSettings.quietMode}
                    >
                      <span className="flex items-center gap-2">
                        <Moon size={16} />
                        Modo silencioso
                      </span>
                      {panelSettings.quietMode && <Check size={16} className="text-orange-300" />}
                    </button>
                    <button
                      type="button"
                      onClick={() => updatePanelSetting("confirmLogout", !panelSettings.confirmLogout)}
                      className="flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-black text-white transition hover:bg-white/[0.07]"
                      role="menuitemcheckbox"
                      aria-checked={panelSettings.confirmLogout}
                    >
                      <span className="flex items-center gap-2">
                        <ShieldCheck size={16} />
                        Confirmar saída
                      </span>
                      {panelSettings.confirmLogout && <Check size={16} className="text-orange-300" />}
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={handleLogout}
                    className="flex w-full items-center justify-center gap-2 rounded-lg border border-red-300/25 bg-red-400/10 px-3 py-2.5 text-sm font-black text-red-100 transition hover:bg-red-400/[0.18]"
                    role="menuitem"
                  >
                    <LogOut size={16} />
                    Sair do painel
                  </button>
                </div>
                </>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  )
}
