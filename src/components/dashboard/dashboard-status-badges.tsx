type ConnectionStatus = "not-configured" | "offline" | "online"

export function ConnectionStatusBadge({
  connectionStatus,
  isSyncing,
}: {
  connectionStatus: ConnectionStatus
  isSyncing: boolean
}) {
  const title = connectionStatus === "online"
    ? "Sinal conectado"
    : connectionStatus === "offline"
      ? "Sinal indisponível"
      : "Sinal aguardando configuração"

  return (
    <span
      className={`inline-flex h-9 w-9 items-center justify-center rounded-lg border ${
      connectionStatus === "online"
        ? "border-emerald-300/25 bg-emerald-400/10 text-emerald-200"
        : connectionStatus === "offline"
          ? "border-red-300/25 bg-red-400/10 text-red-100"
          : "border-cyan-300/25 bg-cyan-400/10 text-cyan-100"
      }`}
      title={title}
      aria-label={title}
    >
      <span className={`h-2.5 w-2.5 rounded-full ${
        connectionStatus === "online"
          ? "bg-emerald-300"
          : connectionStatus === "offline"
            ? "bg-red-300"
            : "bg-cyan-300"
      } ${isSyncing ? "animate-pulse" : ""}`} />
    </span>
  )
}
