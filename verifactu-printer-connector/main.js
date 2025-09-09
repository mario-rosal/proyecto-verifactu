const { app, BrowserWindow, ipcMain, dialog, Tray, Menu, nativeImage } = require('electron');
app.setName('VeriFactu Connector'); // Alinear userData con la carpeta donde el instalador copia config.json
const path = require('path');
const fs = require('fs');
const chokidar = require('chokidar');
const axios = require('axios'); // Importamos axios

let watcher;
let store;
let tray;
let mainWindow;
let isQuiting = false;

// Instancia única
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (!mainWindow.isVisible()) mainWindow.show();
      mainWindow.focus();
    }
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    show: false, // arranca oculta
  });

  mainWindow.loadFile('index.html');

  mainWindow.on('ready-to-show', () => {
    mainWindow.show();
  });

  // Cerrar ventana ⇒ ocultar (quedarse en bandeja)
  mainWindow.on('close', (e) => {
    if (!isQuiting) {
      e.preventDefault();
      mainWindow.hide();
    }
  });
}

async function initialize() {
  const { default: Store } = await import('electron-store');
  store = new Store();
  createWindow();
  createTray();
  // Auto-inicio en Windows (oculta al arrancar)
  try { app.setLoginItemSettings({ openAtLogin: true, openAsHidden: true }); } catch {}
  startWatcher();
}

function createTray() {
  // Icono de bandeja (PNG 16x16 embebido)
  const trayPngBase64 = 'iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAHUlEQVR4nGNkqPr/n4ECwESJ5lEDRg0YNWAwGQAARTkCmKy33akAAAAASUVORK5CYII=';
  const img = nativeImage.createFromBuffer(Buffer.from(trayPngBase64, 'base64'));
  tray = new Tray(img);
  tray.setToolTip('VeriFactu Connector');
  const menu = Menu.buildFromTemplate([
    { label: 'Abrir', click: () => { if (mainWindow) { mainWindow.show(); mainWindow.focus(); } } },
    { type: 'separator' },
    { label: 'Seleccionar carpeta…', click: async () => {
        const { canceled, filePaths } = await dialog.showOpenDialog({ properties: ['openDirectory'] });
        if (!canceled && filePaths[0]) { store.set('folderPath', filePaths[0]); startWatcher(); }
      } 
    },
    { type: 'separator' },
    { label: 'Salir', click: () => { isQuiting = true; if (watcher) watcher.close(); app.quit(); } },
  ]);
  tray.setContextMenu(menu);
  tray.on('click', () => { if (mainWindow) { mainWindow.isVisible() ? mainWindow.hide() : mainWindow.show(); } });
}

function startWatcher() {
  if (!store) return;
  const folderPath = store.get('folderPath');
  if (!folderPath || !fs.existsSync(folderPath)) {
    console.log('[Watcher] No hay una carpeta válida configurada para vigilar.');
    return;
  }
  if (watcher) watcher.close();

  console.log(`[Chokidar] Vigilando la carpeta: ${folderPath}`);
  watcher = chokidar.watch(folderPath, {
    ignored: /^\\\./, // Corrected: escaped backslash for regex
    persistent: true,
    ignoreInitial: true,
    depth: 0,
    // Evita procesar archivos “a medio escribir” (Windows/Explorer, impresoras virtuales, etc.)
    awaitWriteFinish: { stabilityThreshold: 1500, pollInterval: 250 },
  });

  // --- LÓGICA DE ENVÍO ---
  watcher.on('add', async (filePath) => {
    console.log(`[Chokidar] Nuevo archivo detectado: ${filePath}`);
    
    // 👉 usa el perfil del usuario para tomar SOLO la apiKey (con fallback de rutas)
    let apiKey;
    let cfgPath = path.join(app.getPath('userData'), 'config.json'); // %APPDATA%\VeriFactu Connector\config.json tras setName()
    try {
      const cfgRaw = fs.readFileSync(cfgPath, 'utf-8');
      apiKey = JSON.parse(cfgRaw).apiKey;
    } catch (e) {
      // Fallback por si existen instalaciones previas con otro userData
      const altA = process.env.APPDATA ? path.join(process.env.APPDATA, 'VeriFactu Connector', 'config.json') : null;
      const altB = process.env.APPDATA ? path.join(process.env.APPDATA, 'verifactu-printer-connector', 'config.json') : null;
      const candidates = [altA, altB].filter(Boolean);
      for (const p of candidates) {
        try {
          if (fs.existsSync(p)) {
            const raw = fs.readFileSync(p, 'utf-8');
            apiKey = JSON.parse(raw).apiKey;
            cfgPath = p;
            break;
          }
        } catch { /* noop */ }
      }
    }

    // Webhook único para todos los clientes (hardcode)
    const n8nWebhookUrl = 'https://n8n.mrcompa.site/webhook/procesar-pdf'; 

    if (!apiKey || !n8nWebhookUrl.startsWith('http')) {
      console.error('[Envío] Falta la API Key o la URL del Webhook.');
      dialog.showErrorBox('Error de Configuración', 'No se encontró una API Key válida en el perfil del usuario.');
      return;
    }

    const sendWithRetry = async (attempt = 1) => {
      try {
        console.log(`[Envío] Enviando ${path.basename(filePath)} a n8n... (intento ${attempt})`);
        const fileBuffer = fs.readFileSync(filePath);
        const formData = new FormData();
        formData.append('file', new Blob([fileBuffer]), path.basename(filePath));

        await axios.post(n8nWebhookUrl, formData, {
          headers: {
            'X-API-KEY': apiKey,
            'Content-Type': 'multipart/form-data',
          },
          timeout: 15000,
        });

        console.log(`[Envío] Archivo ${path.basename(filePath)} enviado con éxito.`);
        dialog.showMessageBox({
          type: 'info',
          title: 'Factura Enviada',
          message: `La factura ${path.basename(filePath)} se ha enviado para ser procesada.`
        });
      } catch (error) {
        const max = 3;
        if (attempt < max) {
          const backoff = attempt * 1500;
          console.warn(`[Envío] Error (intento ${attempt}): ${error.code || error.message}. Reintento en ${backoff}ms…`);
          setTimeout(() => sendWithRetry(attempt + 1), backoff);
        } else {
          console.error(`[Envío] Fallo definitivo al enviar ${path.basename(filePath)}:`, {
            code: error.code,
            status: error.response?.status,
          });
          dialog.showErrorBox('Error de Envío', `No se pudo enviar la factura. Error: ${error.message}`);
        }
      }
    };
    await sendWithRetry();
  });
  watcher.on('error', (error) => console.error(`[Chokidar] Error: ${error}`));
}

// --- MANEJADORES DE COMUNICACIÓN (IPC) ---
ipcMain.handle('get-settings', async () => {
  if (!store) return {};
  return { folderPath: store.get('folderPath') };
});

ipcMain.handle('open-folder-dialog', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog({ properties: ['openDirectory'] });
  return canceled ? null : filePaths[0];
});

ipcMain.handle('save-settings', async (event, settings) => {
  if (!store) return { success: false };
  store.set('folderPath', settings.folderPath);
  startWatcher();
  return { success: true };
});

// --- CICLO DE VIDA DE LA APLICACIÓN ---
app.whenReady().then(initialize);
// Mantener proceso vivo en Windows aunque no haya ventanas
app.on('window-all-closed', () => {
  // No llamar a app.quit()
});
app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
app.on('before-quit', () => { isQuiting = true; });
