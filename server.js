/**
 * Server para Dashboard de Seguridad CJB
 * Lee el archivo Excel de OneDrive y sirve los datos como API JSON
 */

const express = require('express');
const XLSX = require('xlsx');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3001; // Changed to 3001 to avoid conflicts

// Ruta del archivo Excel en OneDrive sincronizado
const EXCEL_PATH = 'C:\\Users\\Lenovo\\OneDrive - Fideicomiso VBCRD\\Data Formularios\\Registro Rápido de Incidentes (SEGURIDAD).xlsx';

// Habilitar CORS para peticiones desde el navegador
app.use(cors());

// Servir archivos estáticos (el dashboard)
app.use(express.static(__dirname));

/**
 * API Endpoint: /api/incidentes
 * Lee el Excel y devuelve los datos como JSON
 */
app.get('/api/incidentes', (req, res) => {
    try {
        // Verificar que el archivo existe
        if (!fs.existsSync(EXCEL_PATH)) {
            return res.status(404).json({
                error: 'Archivo Excel no encontrado',
                path: EXCEL_PATH
            });
        }

        // Leer el archivo Excel
        const workbook = XLSX.readFile(EXCEL_PATH);

        // Obtener la primera hoja
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];

        // Convertir a JSON (array de objetos)
        const data = XLSX.utils.sheet_to_json(worksheet, {
            raw: false,  // Convertir fechas a strings
            defval: ''   // Valor por defecto para celdas vacías
        });

        console.log(`[${new Date().toLocaleTimeString()}] Datos cargados: ${data.length} registros`);

        // Devolver los datos
        res.json({
            success: true,
            count: data.length,
            lastUpdate: new Date().toISOString(),
            data: data
        });

    } catch (error) {
        console.error('Error leyendo Excel:', error);
        res.status(500).json({
            error: 'Error al leer el archivo Excel',
            details: error.message
        });
    }
});

/**
 * API Endpoint: /api/status
 * Verifica el estado del servidor y la conexión al archivo
 */
app.get('/api/status', (req, res) => {
    const fileExists = fs.existsSync(EXCEL_PATH);
    res.json({
        server: 'running',
        excelPath: EXCEL_PATH,
        fileExists: fileExists,
        timestamp: new Date().toISOString()
    });
});

// Ruta principal - sirve el dashboard
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'Dashboard SEG.html'));
});

// Iniciar servidor
app.listen(PORT, () => {
    console.log('');
    console.log('========================================');
    console.log('  Dashboard Seguridad CJB - Servidor');
    console.log('========================================');
    console.log(`  URL: http://localhost:${PORT}`);
    console.log(`  API: http://localhost:${PORT}/api/incidentes`);
    console.log('');
    console.log('  Excel:', EXCEL_PATH);
    console.log('  Archivo existe:', fs.existsSync(EXCEL_PATH) ? 'SI' : 'NO');
    console.log('========================================');
    console.log('');
});
