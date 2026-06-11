const { app, BrowserWindow, Menu, ipcMain } = require("electron");
const { spawn } = require("child_process");
const fs = require("fs");
const net = require("net");
const path = require("path");

const isDev = !app.isPackaged;
const appIcon = isDev
  ? path.join(__dirname, "../build/icon.png")
  : path.join(process.resourcesPath, "build/icon.png");
const thermalReceiptPageSize = {
  width: 80000,
  height: 300000
};
const preferredPrinterName = process.env.PITS_DOG_PRINTER_NAME || "";
const directPrinterDevice = process.env.PITS_DOG_PRINTER_DEVICE || "";
const networkPrinterHost = process.env.PITS_DOG_PRINTER_HOST || "";
const networkPrinterPort = Number(process.env.PITS_DOG_PRINTER_PORT || 9100);
const likelyPrinterDevices = [
  "/dev/usb/lp0",
  "/dev/usb/lp1",
  "/dev/lp0",
  "/dev/lp1",
  "/dev/ttyUSB0",
  "/dev/ttyUSB1",
  "/dev/ttyACM0",
  "/dev/ttyACM1"
];
const likelyNetworkPrinterHosts = [
  "192.168.3.17"
];

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1366,
    height: 768,
    minWidth: 1024,
    minHeight: 680,
    title: "Pits Dog Admin",
    icon: appIcon,
    backgroundColor: "#070604",

    frame: true,
    resizable: true,
    minimizable: true,
    maximizable: true,
    closable: true,
    fullscreenable: false,

    autoHideMenuBar: true,
    show: false,

    webPreferences: {
      backgroundThrottling: false,
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, "preload.cjs"),
      zoomFactor: 1
    }
  });

  Menu.setApplicationMenu(null);

  const ADMIN_URL = isDev
    ? "http://localhost:5173"
    : "https://pitsdog-painel-admin.onrender.com";

  mainWindow.loadURL(ADMIN_URL);

  mainWindow.once("ready-to-show", () => {
    mainWindow.maximize();
    mainWindow.show();
  });

  mainWindow.webContents.on("before-input-event", (event, input) => {
    if (input.key === "F11" && input.type === "keyDown") {
      event.preventDefault();

      if (mainWindow.isMaximized()) {
        mainWindow.unmaximize();
      } else {
        mainWindow.maximize();
      }
    }
  });
}
async function resolvePrinterName(printWindow) {
  const printers = await printWindow.webContents.getPrintersAsync().catch(() => []);

  if (preferredPrinterName) {
    const configuredPrinter = printers.find((printer) =>
      printer.name.toLowerCase().includes(preferredPrinterName.toLowerCase())
    );

    if (configuredPrinter) return configuredPrinter.name;
  }

  const thermalPrinter = printers.find((printer) =>
    /vt-?8360|thermal|receipt|pos|cupom/i.test(printer.name)
  );

  if (thermalPrinter) return thermalPrinter.name;

  const defaultPrinter = printers.find((printer) => printer.isDefault);

  return defaultPrinter?.name;
}

function printHtml(html) {
  return new Promise((resolve, reject) => {
    const printWindow = new BrowserWindow({
      width: 420,
      height: 720,
      show: false,
      webPreferences: {
        backgroundThrottling: false,
        contextIsolation: true,
        nodeIntegration: false
      }
    });

    let didFinish = false;
    const timeout = setTimeout(() => {
      if (didFinish) return;
      didFinish = true;
      printWindow.destroy();
      reject(new Error("Tempo limite ao preparar a impressão."));
    }, 15000);

    printWindow.webContents.once("did-finish-load", async () => {
      const deviceName = await resolvePrinterName(printWindow);

      printWindow.webContents.print({
        ...(deviceName ? { deviceName } : {}),
        margins: { marginType: "none" },
        pageSize: thermalReceiptPageSize,
        printBackground: false,
        scaleFactor: 100,
        silent: true
      }, (success, failureReason) => {
        if (didFinish) return;
        didFinish = true;
        clearTimeout(timeout);
        printWindow.destroy();

        if (!success) {
          reject(new Error(failureReason || "Falha ao imprimir."));
          return;
        }

        resolve({ ok: true });
      });
    });

    printWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
  });
}

function runCommand(command, args, input) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: ["pipe", "pipe", "pipe"]
    });

    let stderr = "";

    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolve({ ok: true });
        return;
      }

      reject(new Error(stderr.trim() || `${command} finalizou com código ${code}.`));
    });

    child.stdin.end(input);
  });
}

function listCupsPrinters() {
  return new Promise((resolve) => {
    const child = spawn("lpstat", ["-p"], {
      stdio: ["ignore", "pipe", "ignore"]
    });

    let stdout = "";

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });

    child.on("error", () => resolve([]));
    child.on("close", () => {
      const printers = stdout
        .split("\n")
        .map((line) => line.match(/^printer\s+(\S+)/)?.[1])
        .filter(Boolean);

      resolve(printers);
    });
  });
}

async function resolveCommandPrinterName() {
  const printers = await listCupsPrinters();

  if (preferredPrinterName) {
    const configuredPrinter = printers.find((printer) =>
      printer.toLowerCase().includes(preferredPrinterName.toLowerCase())
    );

    if (configuredPrinter) return configuredPrinter;
  }

  return printers.find((printer) =>
    !/cups-brf/i.test(printer) && /vt-?8360|thermal|receipt|pos|cupom/i.test(printer)
  ) || printers.find((printer) => !/cups-brf/i.test(printer));
}

async function findDirectPrinterDevice() {
  if (directPrinterDevice) return directPrinterDevice;

  for (const devicePath of likelyPrinterDevices) {
    try {
      await fs.promises.access(devicePath, fs.constants.W_OK);
      return devicePath;
    } catch {
      // Testa o proximo caminho conhecido de impressora USB/serial.
    }
  }

  for (const devicePath of likelyPrinterDevices) {
    try {
      await fs.promises.access(devicePath, fs.constants.F_OK);
      return devicePath;
    } catch {
      // Existe permissao/driver faltando ou o device realmente nao esta presente.
    }
  }

  return "";
}

async function writeDirectPrinterDevice(devicePath, payload) {
  try {
    await fs.promises.appendFile(devicePath, payload);
    return { ok: true };
  } catch (error) {
    if (error?.code === "EACCES") {
      throw new Error(
        `Sem permissao para imprimir em ${devicePath}. Teste: sudo chmod 666 ${devicePath} ou rode o app com PITS_DOG_PRINTER_DEVICE=${devicePath}.`
      );
    }

    throw error;
  }
}

function canConnectToPrinter(host, port = networkPrinterPort, timeoutMs = 700) {
  return new Promise((resolve) => {
    const socket = net.createConnection({ host, port });
    let done = false;

    const finish = (result) => {
      if (done) return;
      done = true;
      socket.destroy();
      resolve(result);
    };

    socket.setTimeout(timeoutMs);
    socket.once("connect", () => finish(true));
    socket.once("timeout", () => finish(false));
    socket.once("error", () => finish(false));
  });
}

async function resolveNetworkPrinterHost() {
  if (networkPrinterHost) return networkPrinterHost;

  for (const host of likelyNetworkPrinterHosts) {
    if (await canConnectToPrinter(host)) return host;
  }

  return "";
}

function writeNetworkPrinter(host, payload, port = networkPrinterPort) {
  return new Promise((resolve, reject) => {
    const socket = net.createConnection({ host, port });
    let finished = false;

    const finish = (error) => {
      if (finished) return;
      finished = true;
      socket.destroy();

      if (error) {
        reject(error);
        return;
      }

      resolve({ ok: true });
    };

    socket.setTimeout(5000);
    socket.once("connect", () => {
      socket.end(payload);
    });
    socket.once("timeout", () => finish(new Error(`Tempo limite ao conectar na impressora ${host}:${port}.`)));
    socket.once("error", (error) => finish(error));
    socket.once("close", (hadError) => {
      if (!hadError) finish();
    });
  });
}

async function printReceiptText(text) {
  const payload = Buffer.from(`\x1b@${text.replace(/\r?\n/g, "\n")}\n\n\n\x1dV\x00`, "utf8");
  const printerHost = await resolveNetworkPrinterHost();

  if (printerHost) return writeNetworkPrinter(printerHost, payload);

  const printerDevice = await findDirectPrinterDevice();

  if (printerDevice) return writeDirectPrinterDevice(printerDevice, payload);

  const printerName = await resolveCommandPrinterName();

  if (!printerName) {
    throw new Error(
      "Nenhuma impressora termica encontrada. Para Wi-Fi, abra com PITS_DOG_PRINTER_HOST=IP_DA_IMPRESSORA. Para USB, use PITS_DOG_PRINTER_DEVICE=/dev/usb/lp0."
    );
  }

  return runCommand("lp", ["-d", printerName, "-o", "raw", "-t", "Pits Dog Comanda"], payload);
}

ipcMain.handle("pitsdog:print-html", async (_event, html) => {
  if (typeof html !== "string" || !html.trim()) {
    throw new Error("Conteúdo de impressão inválido.");
  }

  return printHtml(html);
});

ipcMain.handle("pitsdog:print-receipt-text", async (_event, text) => {
  if (typeof text !== "string" || !text.trim()) {
    throw new Error("Conteúdo de impressão inválido.");
  }

  return printReceiptText(text);
});

app.whenReady().then(createWindow);

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
