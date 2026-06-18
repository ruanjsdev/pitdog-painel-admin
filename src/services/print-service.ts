import type { Order } from "../types/order"

type TicketKind = "delivery-label" | "kitchen"

type PrintOptions = {
  copies?: number
}

function escapeHtml(value: unknown) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;")
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    currency: "BRL",
    style: "currency",
  }).format(value)
}

function getOrderTotal(order: Order) {
  const subtotal = order.subtotal ?? order.total
  const percentageDiscount = order.discountPercent ? subtotal * (order.discountPercent / 100) : 0
  const discount = order.discount ?? percentageDiscount

  return Math.max(0, subtotal + (order.deliveryFee ?? 0) - discount)
}

function normalizeReceiptText(value: unknown) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\x20-\x7E\n]/g, "")
}

const receiptTextWidth = 24

function centerLine(value: string, width = receiptTextWidth) {
  const text = normalizeReceiptText(value).slice(0, width)
  const leftPadding = Math.max(0, Math.floor((width - text.length) / 2))

  return `${" ".repeat(leftPadding)}${text}`
}

function divider(width = receiptTextWidth) {
  return "-".repeat(width)
}

function wrapLine(value: string, width = receiptTextWidth) {
  const words = normalizeReceiptText(value).split(/\s+/).filter(Boolean)
  const lines: string[] = []
  let currentLine = ""

  for (const word of words) {
    const nextLine = currentLine ? `${currentLine} ${word}` : word

    if (nextLine.length <= width) {
      currentLine = nextLine
      continue
    }

    if (currentLine) lines.push(currentLine)
    currentLine = word
  }

  if (currentLine) lines.push(currentLine)

  return lines.length ? lines : [""]
}

function buildTicketText(title: string, order: Order, kind: TicketKind) {
  const isDelivery = order.delivery === "Delivery"
  const isTable = order.delivery === "Mesa"
  const printedAt = new Date().toLocaleString("pt-BR", {
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    month: "2-digit",
  })

  const lines = [
    centerLine("PITS DOG"),
    centerLine(title),
    divider(),
    centerLine(`${order.delivery.toUpperCase()} #${order.id}`),
    divider(),
    `Cliente: ${normalizeReceiptText(order.customer || "-")}`,
    divider(),
  ]

  lines.push("ITENS")

  if (order.items.length) {
    order.items.forEach((item) => {
      wrapLine(`* ${item}`).forEach((line) => lines.push(line))
      lines.push("")
    })
  } else {
    lines.push("Pedido sem itens detalhados")
  }

  lines.push(divider())
  lines.push(`Telefone: ${normalizeReceiptText(order.phone || "-")}`)
  lines.push(`Horario: ${normalizeReceiptText(order.time || printedAt)}`)
  lines.push(`Impresso: ${normalizeReceiptText(printedAt)}`)
  lines.push(divider())

  if (isDelivery) {
    lines.push("ENTREGA")
    lines.push(...wrapLine(order.address || "Endereco nao informado"))
    lines.push(`Motoboy: ${normalizeReceiptText(order.courierName || "nao selecionado")}`)
    lines.push(divider())
  } else {
    lines.push(isTable ? "MESA" : "RETIRADA")
    lines.push(...wrapLine(order.address || (isTable ? "Mesa nao informada" : "Retirada no balcao")))
    lines.push(divider())
  }

  if (kind === "delivery-label") {
    lines.push("PAGAMENTO")
    lines.push(normalizeReceiptText(order.payment || "-"))
    lines.push(`Total: ${formatCurrency(getOrderTotal(order))}`)

    if (order.payment === "Dinheiro" && order.needsChange) {
      lines.push(`Troco para: ${formatCurrency(order.changeFor ?? 0)}`)
    }

    lines.push(divider())
  }

  if (order.notes) {
    lines.push(divider())
    lines.push("OBSERVACAO")
    lines.push(...wrapLine(order.notes))
  }

  lines.push(divider())
  lines.push(centerLine(kind === "kitchen" ? "Comanda da cozinha" : "Etiqueta de entrega"))

  return `${lines.join("\n")}\n`
}

function buildTicketHtml(title: string, order: Order, kind: TicketKind) {
  const isDelivery = order.delivery === "Delivery"
  const isTable = order.delivery === "Mesa"
  const printedAt = new Date().toLocaleString("pt-BR", {
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    month: "2-digit",
  })

  const items = order.items.length
    ? order.items.map((item) => `<li>${escapeHtml(item)}</li>`).join("")
    : "<li>Pedido sem itens detalhados</li>"

  const deliveryBlock = isDelivery
    ? `
      <section class="block">
        <strong>ENTREGA</strong>
        <p>${escapeHtml(order.address || "Endereço não informado")}</p>
        <p>Motoboy: ${escapeHtml(order.courierName || "não selecionado")}</p>
      </section>
    `
    : `
      <section class="block">
        <strong>${isTable ? "MESA" : "RETIRADA"}</strong>
        <p>${escapeHtml(order.address || (isTable ? "Mesa não informada" : "Retirada no balcão"))}</p>
      </section>
    `

  const paymentBlock = kind === "delivery-label"
    ? `
      <section class="block">
        <strong>PAGAMENTO</strong>
        <p>${escapeHtml(order.payment || "-")}</p>
        <p class="total">Total: ${formatCurrency(getOrderTotal(order))}</p>
        ${order.payment === "Dinheiro" && order.needsChange ? `<p>Troco para: ${formatCurrency(order.changeFor ?? 0)}</p>` : ""}
      </section>
    `
    : ""

  return `<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="utf-8">
    <title>${escapeHtml(title)} #${escapeHtml(order.id)}</title>
    <style>
      @page { size: 80mm 300mm; margin: 0; }
      * { box-sizing: border-box; }
      html {
        width: 80mm;
        margin: 0;
        padding: 0;
      }
      body {
        width: 72mm;
        margin: 0;
        padding: 4mm 2mm 10mm;
        color: #000;
        font-family: Arial, Helvetica, sans-serif;
        font-size: 15px;
        line-height: 1.32;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }
      h1, h2, p { margin: 0; }
      h1 { font-size: 25px; text-align: center; }
      h2 { margin-top: 2mm; font-size: 19px; text-align: center; }
      ul { margin: 2mm 0 0; padding: 0; list-style: none; }
      li { padding: 2mm 0; border-bottom: 1px dashed #000; font-size: 17px; font-weight: 900; }
      .pill {
        margin: 2mm auto;
        padding: 1.5mm;
        border: 2px solid #000;
        text-align: center;
        font-size: 20px;
        font-weight: 900;
      }
      .meta { margin-top: 2mm; display: grid; gap: 1mm; }
      .block { margin-top: 3mm; padding-top: 2mm; border-top: 2px solid #000; }
      .block strong { display: block; margin-bottom: 1mm; font-size: 16px; }
      .itemsTitle { margin-top: 3mm; padding-top: 2mm; border-top: 3px solid #000; font-size: 18px; font-weight: 900; }
      .total { margin-top: 1mm; font-size: 18px; font-weight: 900; }
      .footer { margin-top: 4mm; border-top: 1px dashed #000; padding-top: 2mm; text-align: center; font-size: 12px; }
    </style>
  </head>
  <body>
    <h1>PITS DOG</h1>
    <h2>${escapeHtml(title)}</h2>
    <div class="pill">${escapeHtml(order.delivery).toUpperCase()} #${escapeHtml(order.id)}</div>
    <section class="meta">
      <p><strong>Cliente:</strong> ${escapeHtml(order.customer || "-")}</p>
    </section>
    <p class="itemsTitle">ITENS</p>
    <ul>${items}</ul>
    <section class="meta">
      <p><strong>Telefone:</strong> ${escapeHtml(order.phone || "-")}</p>
      <p><strong>Horário:</strong> ${escapeHtml(order.time || printedAt)}</p>
      <p><strong>Impresso:</strong> ${escapeHtml(printedAt)}</p>
    </section>
    ${deliveryBlock}
    ${paymentBlock}
    ${order.notes ? `<section class="block"><strong>OBSERVAÇÃO</strong><p>${escapeHtml(order.notes)}</p></section>` : ""}
    <p class="footer">${kind === "kitchen" ? "Comanda da cozinha" : "Etiqueta/recibo de entrega"}</p>
  </body>
</html>`
}

async function printReceiptText(text: string) {
  const printerApi = window.pitsDog?.printer ?? window.pitsDogPrinter

  if (!printerApi?.printReceiptText) {
    throw new Error("Impressão térmica por comando disponível apenas no app desktop.")
  }

  const result = await printerApi.printReceiptText(text)

  if (!result.ok) {
    throw new Error(result.error || "Não foi possível imprimir a comanda.")
  }
}

async function printHtml(html: string) {
  if (window.pitsDogPrinter) {
    const result = await window.pitsDogPrinter.printHtml(html)

    if (!result.ok) {
      throw new Error(result.error || "Não foi possível imprimir a comanda.")
    }
    return
  }

  await new Promise<void>((resolve, reject) => {
    const iframe = document.createElement("iframe")

    iframe.style.position = "fixed"
    iframe.style.right = "0"
    iframe.style.bottom = "0"
    iframe.style.width = "0"
    iframe.style.height = "0"
    iframe.style.border = "0"
    iframe.onload = () => {
      window.setTimeout(() => {
        try {
          iframe.contentWindow?.focus()
          iframe.contentWindow?.print()
          resolve()
        } catch (error) {
          reject(error)
        } finally {
          window.setTimeout(() => iframe.remove(), 1000)
        }
      }, 150)
    }

    document.body.appendChild(iframe)

    const iframeDocument = iframe.contentDocument ?? iframe.contentWindow?.document

    if (!iframeDocument) {
      iframe.remove()
      reject(new Error("Não foi possível preparar a impressão."))
      return
    }

    iframeDocument.open()
    iframeDocument.write(html)
    iframeDocument.close()
  })
}

async function printCopies(html: string, copies = 1) {
  const safeCopies = Math.max(1, Math.min(5, Math.floor(copies)))

  for (let copy = 0; copy < safeCopies; copy += 1) {
    await printHtml(html)
  }
}

async function printTextCopies(text: string, copies = 1) {
  const safeCopies = Math.max(1, Math.min(5, Math.floor(copies)))

  for (let copy = 0; copy < safeCopies; copy += 1) {
    await printReceiptText(text)
  }
}

export async function printKitchenTicket(order: Order, options: PrintOptions = {}) {
  if (window.pitsDog?.printer?.printReceiptText || window.pitsDogPrinter?.printReceiptText) {
    await printTextCopies(buildTicketText("COMANDA COZINHA", order, "kitchen"), options.copies)
    return
  }

  await printCopies(buildTicketHtml("COMANDA COZINHA", order, "kitchen"), options.copies)
}

export async function printDeliveryLabel(order: Order, options: PrintOptions = {}) {
  if (window.pitsDog?.printer?.printReceiptText || window.pitsDogPrinter?.printReceiptText) {
    await printTextCopies(buildTicketText("ETIQUETA ENTREGA", order, "delivery-label"), options.copies)
    return
  }

  await printCopies(buildTicketHtml("ETIQUETA ENTREGA", order, "delivery-label"), options.copies)
}

export async function printApprovalTickets(order: Order, options: PrintOptions = {}) {
  await printKitchenTicket(order, { ...options, copies: 1 })
}
