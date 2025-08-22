const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const chokidar = require('chokidar');
const axios = require('axios'); // Importamos axios

let watcher;
let store;

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.loadFile('index.html');
}

async function initialize() {
  const { default: Store } = await import('electron-store');
  store = new Store();
  createWindow();
  startWatcher();
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
    ignored: /^\./,
    persistent: true,
    ignoreInitial: true,
  });

  // --- LÓGICA DE ENVÍO ---
  watcher.on('add', async (filePath) => {
    console.log(`[Chokidar] Nuevo archivo detectado: ${filePath}`);
    
    // Leemos la API Key desde el archivo de configuración
    let apiKey;
    try {
      const configFile = fs.readFileSync(path.join(__dirname, 'config.json'));
      apiKey = JSON.parse(configFile).apiKey;
    } catch (error) {
      console.error('[Config] Error al leer el archivo config.json:', error);
      dialog.showErrorBox('Error de Configuración', 'No se pudo leer el archivo de configuración (config.json).');
      return;
    }
    
    // En el siguiente paso, crearemos este webhook en n8n y pondremos la URL real aquí.
    const n8nWebhookUrl = 'https://n8n.mrcompa.site/webhook/procesar-pdf'; 

    if (!apiKey || !n8nWebhookUrl.startsWith('http')) {
      console.error('[Envío] Falta la API Key o la URL del Webhook.');
      dialog.showErrorBox('Error de Configuración', 'Por favor, asegúrate de que la URL del webhook es correcta.');
      return;
    }

    try {
      const fileBuffer = fs.readFileSync(filePath);
      const formData = new FormData();
      formData.append('file', new Blob([fileBuffer]), path.basename(filePath));

      console.log(`[Envío] Enviando ${path.basename(filePath)} a n8n...`);

      await axios.post(n8nWebhookUrl, formData, {
        headers: {
          'X-API-KEY': apiKey,
          'Content-Type': 'multipart/form-data',
        },
      });

      console.log(`[Envío] Archivo ${path.basename(filePath)} enviado con éxito.`);
      dialog.showMessageBox({
        type: 'info',
        title: 'Factura Enviada',
        message: `La factura ${path.basename(filePath)} se ha enviado para ser procesada.`
      });

    } catch (error) {
      console.error('[Envío] Error al enviar el archivo:', error.message);
      dialog.showErrorBox('Error de Envío', `No se pudo enviar la factura. Error: ${error.message}`);
    }
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
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
