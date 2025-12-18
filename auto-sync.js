/**
 * Auto-Sync: Vigilante de Cambios en Excel
 * =========================================
 * 
 * Este script monitorea el archivo Excel en OneDrive.
 * Cuando detecta cambios, automáticamente:
 * 1. Exporta los datos a JSON
 * 2. Hace commit y push a GitHub
 * 
 * Uso: node auto-sync.js
 * (Déjalo corriendo en segundo plano)
 */

const chokidar = require('chokidar');
const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

// Configuración
const EXCEL_PATH = 'C:\\Users\\Lenovo\\OneDrive - Fideicomiso VBCRD\\Data Formularios\\Registro Rápido de Incidentes (SEGURIDAD).xlsx';
const OUTPUT_PATH = path.join(__dirname, 'data.json');
const MIN_INTERVAL = 30000; // Mínimo 30 segundos entre sincronizaciones

let lastSync = 0;
let syncInProgress = false;

console.log('');
console.log('==========================================');
console.log('  🔄 Auto-Sync Dashboard Seguridad CJB');
console.log('==========================================');
console.log('');
console.log('📁 Monitoreando:', EXCEL_PATH);
console.log('📤 Destino:', OUTPUT_PATH);
console.log('');
console.log('⏳ Esperando cambios en el archivo Excel...');
console.log('   (Presiona Ctrl+C para detener)');
console.log('');

// Función para exportar y sincronizar
async function syncData() {
    const now = Date.now();

    // Evitar sincronizaciones muy frecuentes
    if (now - lastSync < MIN_INTERVAL) {
        console.log(`⏳ [${getTime()}] Esperando ${Math.ceil((MIN_INTERVAL - (now - lastSync)) / 1000)}s antes de sincronizar...`);
        return;
    }

    if (syncInProgress) {
        console.log(`⏳ [${getTime()}] Sincronización en progreso, esperando...`);
        return;
    }

    syncInProgress = true;
    lastSync = now;

    try {
        console.log(`📂 [${getTime()}] Cambio detectado, exportando datos...`);

        // Verificar que el archivo existe
        if (!fs.existsSync(EXCEL_PATH)) {
            throw new Error('Archivo Excel no encontrado');
        }

        // Esperar un momento para que OneDrive termine de sincronizar
        await sleep(2000);

        // Leer el archivo Excel
        const workbook = XLSX.readFile(EXCEL_PATH);
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const data = XLSX.utils.sheet_to_json(worksheet, { raw: false, defval: '' });

        console.log(`   ✅ ${data.length} registros leídos`);

        // Crear objeto con metadatos
        const output = {
            lastUpdate: new Date().toISOString(),
            count: data.length,
            data: data
        };

        // Guardar como JSON
        fs.writeFileSync(OUTPUT_PATH, JSON.stringify(output, null, 2), 'utf8');
        console.log(`   ✅ JSON exportado`);

        // Git add, commit, push
        console.log(`   📤 Subiendo a GitHub...`);

        await execPromise('git add data.json');
        await execPromise(`git commit -m "auto-sync: ${data.length} registros - ${new Date().toLocaleString('es-DO')}"`);
        await execPromise('git push origin main');

        console.log(`   ✅ [${getTime()}] ¡Sincronización completada!`);
        console.log(`   🌐 Los usuarios verán los cambios en ~1 minuto.`);
        console.log('');

    } catch (error) {
        if (error.message && error.message.includes('nothing to commit')) {
            console.log(`   ℹ️ [${getTime()}] Sin cambios nuevos para subir.`);
        } else {
            console.error(`   ❌ [${getTime()}] Error:`, error.message);
        }
    } finally {
        syncInProgress = false;
    }
}

// Utilidades
function getTime() {
    return new Date().toLocaleTimeString('es-DO');
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function execPromise(command) {
    return new Promise((resolve, reject) => {
        exec(command, { cwd: __dirname }, (error, stdout, stderr) => {
            if (error && !stderr.includes('nothing to commit')) {
                reject(error);
            } else {
                resolve(stdout);
            }
        });
    });
}

// Iniciar el vigilante
const watcher = chokidar.watch(EXCEL_PATH, {
    persistent: true,
    ignoreInitial: true,
    awaitWriteFinish: {
        stabilityThreshold: 5000,
        pollInterval: 1000
    }
});

watcher
    .on('change', syncData)
    .on('error', error => console.error('Error en vigilante:', error));

// Hacer una sincronización inicial
console.log('🔄 Ejecutando sincronización inicial...');
syncData();
