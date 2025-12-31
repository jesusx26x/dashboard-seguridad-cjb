/**
 * Auto-Sync: Sincronización Directa desde SharePoint
 * ===================================================
 * 
 * Este script descarga el Excel directamente desde SharePoint
 * y lo sube a GitHub automáticamente.
 * 
 * Uso: node auto-sync.js
 * (Déjalo corriendo en segundo plano)
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const { exec } = require('child_process');
const XLSX = require('xlsx');

// Configuración
const SHAREPOINT_URL = 'https://vbcrd-my.sharepoint.com/:x:/g/personal/jesusdelossantos_vbc_gob_do/IQCbhrkDR0u2Q5KenioSh3eeAczGCtQiJzb22PSfPfTNqLo?e=SR2odg&download=1';
const OUTPUT_PATH = path.join(__dirname, 'data.json');
const TEMP_EXCEL = path.join(__dirname, 'temp-sharepoint.xlsx');
const SYNC_INTERVAL = 2 * 60 * 1000; // 2 minutos

let lastRecordCount = 0;
let syncInProgress = false;

console.log('');
console.log('==========================================');
console.log('  🔄 Auto-Sync Dashboard Seguridad CJB');
console.log('  📡 Conexión Directa a SharePoint');
console.log('==========================================');
console.log('');
console.log('🌐 Fuente:', 'SharePoint Excel');
console.log('📤 Destino:', OUTPUT_PATH);
console.log('⏱️  Intervalo:', SYNC_INTERVAL / 1000, 'segundos');
console.log('');
console.log('   (Presiona Ctrl+C para detener)');
console.log('');

// Descargar archivo desde SharePoint
function downloadFromSharePoint() {
    return new Promise((resolve, reject) => {
        const file = fs.createWriteStream(TEMP_EXCEL);

        // Seguir redirecciones
        const download = (url) => {
            https.get(url, (response) => {
                if (response.statusCode === 301 || response.statusCode === 302) {
                    download(response.headers.location);
                    return;
                }

                if (response.statusCode !== 200) {
                    reject(new Error(`HTTP ${response.statusCode}`));
                    return;
                }

                response.pipe(file);
                file.on('finish', () => {
                    file.close();
                    resolve();
                });
            }).on('error', (err) => {
                fs.unlink(TEMP_EXCEL, () => { });
                reject(err);
            });
        };

        download(SHAREPOINT_URL);
    });
}

// Función principal de sincronización
async function syncFromSharePoint() {
    if (syncInProgress) return;

    syncInProgress = true;
    const time = new Date().toLocaleTimeString('es-DO');

    try {
        console.log(`📥 [${time}] Descargando desde SharePoint...`);

        await downloadFromSharePoint();

        // Leer Excel descargado
        const workbook = XLSX.readFile(TEMP_EXCEL);
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const data = XLSX.utils.sheet_to_json(worksheet, { raw: false, defval: '' });

        console.log(`   ✅ ${data.length} registros leídos`);

        // Solo sincronizar si hay cambios
        if (data.length === lastRecordCount) {
            console.log(`   ℹ️  Sin cambios (${data.length} registros)`);
            console.log('');
            syncInProgress = false;
            return;
        }

        console.log(`   🆕 Cambio detectado: ${lastRecordCount} → ${data.length} registros`);
        lastRecordCount = data.length;

        // Crear JSON
        const output = {
            source: 'SharePoint',
            lastUpdate: new Date().toISOString(),
            count: data.length,
            data: data
        };

        fs.writeFileSync(OUTPUT_PATH, JSON.stringify(output, null, 2), 'utf8');
        console.log(`   ✅ JSON exportado`);

        // Git add, commit, push
        console.log(`   📤 Subiendo a GitHub...`);

        await execPromise('git add data.json');
        await execPromise(`git commit -m "auto-sync: ${data.length} registros - ${new Date().toLocaleString('es-DO')}"`);
        await execPromise('git push origin main');

        console.log(`   ✅ [${time}] ¡Sincronización completada!`);
        console.log(`   🌐 Los usuarios verán los cambios en ~1 minuto.`);
        console.log('');

    } catch (error) {
        if (error.message && error.message.includes('nothing to commit')) {
            console.log(`   ℹ️  Sin cambios para subir a GitHub`);
        } else {
            console.error(`   ❌ Error:`, error.message);
        }
        console.log('');
    } finally {
        syncInProgress = false;
        // Limpiar archivo temporal
        try { fs.unlinkSync(TEMP_EXCEL); } catch (e) { }
    }
}

function execPromise(command) {
    return new Promise((resolve, reject) => {
        exec(command, { cwd: __dirname }, (error, stdout, stderr) => {
            if (error && !stderr.includes('nothing to commit') && !stdout.includes('nothing to commit')) {
                reject(error);
            } else {
                resolve(stdout);
            }
        });
    });
}

// Sincronización inicial
console.log('🔄 Ejecutando sincronización inicial...');
console.log('');
syncFromSharePoint();

// Sincronizar cada 2 minutos
setInterval(syncFromSharePoint, SYNC_INTERVAL);
