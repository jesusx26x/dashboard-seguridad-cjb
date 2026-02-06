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

// ============================================
// IDS (Índice de Desarrollo Social) - Pilar Seguridad
// ============================================

const CJB_POPULATION = 50000; // Población aproximada de CJB
const CJB_FAMILIES = 14500;   // Familias en CJB

// Palabras clave para inferir robos/hurtos de la narrativa (SEG-02)
const ROBO_KEYWORDS = ['robo', 'hurto', 'asalto', 'atraco', 'sustracción', 'despojo', 'robado', 'hurtado', 'asaltado'];

// Función para leer datos del Excel
function readExcelData() {
    if (!fs.existsSync(EXCEL_PATH)) {
        return null;
    }
    const workbook = XLSX.readFile(EXCEL_PATH);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    return XLSX.utils.sheet_to_json(worksheet, { raw: false, defval: '' });
}

// Función para parsear fecha del Excel
function parseExcelDate(dateValue) {
    if (!dateValue) return null;
    // Si es número (serial de Excel)
    if (typeof dateValue === 'number') {
        const date = new Date((dateValue - 25569) * 86400 * 1000);
        return date;
    }
    // Si es string, intentar parsear
    const parsed = new Date(dateValue);
    return isNaN(parsed) ? null : parsed;
}

// Función para verificar si registro está en período
function isInPeriod(record, startDate, endDate) {
    const recordDate = parseExcelDate(record['Hora de inicio']);
    if (!recordDate) return false;
    return recordDate >= startDate && recordDate <= endDate;
}

// Función para detectar robo/hurto en narrativa
function isRoboHurto(record) {
    const narrativa = (record['Narrativa del Incidente'] || '').toLowerCase();
    const tipo = (record['Tipo de Incidente'] || '').toLowerCase();

    return ROBO_KEYWORDS.some(keyword =>
        narrativa.includes(keyword) || tipo.includes(keyword)
    );
}

// Función para detectar acciones preventivas
function isPreventiveAction(record) {
    const acciones = (record['Acciones Tomadas'] || '').toLowerCase();
    const preventiveKeywords = ['patrullaje', 'operativo', 'chequeo', 'rutina', 'prevención'];
    return preventiveKeywords.some(keyword => acciones.includes(keyword));
}

// Función para calcular indicadores de un período
function calculateIndicators(data, period) {
    const now = new Date();
    let startDate, endDate, periodLabel;

    // Calcular fechas según período
    switch (period) {
        case 'monthly':
            startDate = new Date(now.getFullYear(), now.getMonth(), 1);
            endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
            periodLabel = startDate.toLocaleDateString('es-DO', { month: 'long', year: 'numeric' });
            break;
        case 'quarterly':
            const quarter = Math.floor(now.getMonth() / 3);
            startDate = new Date(now.getFullYear(), quarter * 3, 1);
            endDate = new Date(now.getFullYear(), quarter * 3 + 3, 0);
            periodLabel = `Q${quarter + 1} ${now.getFullYear()}`;
            break;
        case 'semester':
            const semester = now.getMonth() < 6 ? 0 : 1;
            startDate = new Date(now.getFullYear(), semester * 6, 1);
            endDate = new Date(now.getFullYear(), semester * 6 + 6, 0);
            periodLabel = `${semester === 0 ? '1er' : '2do'} Semestre ${now.getFullYear()}`;
            break;
        case 'annual':
            startDate = new Date(now.getFullYear(), 0, 1);
            endDate = new Date(now.getFullYear(), 11, 31);
            periodLabel = `${now.getFullYear()}`;
            break;
        default:
            startDate = new Date(now.getFullYear(), now.getMonth(), 1);
            endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
            periodLabel = startDate.toLocaleDateString('es-DO', { month: 'long', year: 'numeric' });
    }

    // Filtrar datos del período
    const periodData = data.filter(r => isInPeriod(r, startDate, endDate));

    // SEG-01: Delitos Violentos (tipo "Seguridad CJB" con arresto/detención)
    const seg01Data = periodData.filter(r =>
        r['Tipo de Incidente'] === 'Seguridad CJB' &&
        (r['Acciones Tomadas'] || '').toLowerCase().includes('arresto') ||
        (r['Acciones Tomadas'] || '').toLowerCase().includes('detención')
    );
    const seg01Count = seg01Data.length;
    const seg01Rate = (seg01Count / CJB_POPULATION) * 1000;

    // SEG-02: Robos y Hurtos (inferido de narrativa)
    const seg02Data = periodData.filter(r => isRoboHurto(r));
    const seg02Count = seg02Data.length;
    const seg02Rate = (seg02Count / CJB_POPULATION) * 1000;

    // SEG-05: Acciones Preventivas
    const seg05Data = periodData.filter(r => isPreventiveAction(r));
    const seg05Count = seg05Data.length;

    return {
        period: periodLabel,
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        totalRecords: periodData.length,
        indicators: [
            {
                code: 'SEG-01',
                name: 'Tasa de Delitos Violentos y Homicidios',
                frequency: 'Mensual',
                value: seg01Count,
                rate: seg01Rate.toFixed(2),
                unit: 'por 1,000 hab.',
                status: seg01Count > 0 ? 'Completo' : 'Pendiente',
                source: 'Automático - Forms',
                details: `${seg01Count} incidentes con arresto/detención`
            },
            {
                code: 'SEG-02',
                name: 'Tasa de Robos y Hurtos',
                frequency: 'Mensual',
                value: seg02Count,
                rate: seg02Rate.toFixed(2),
                unit: 'por 1,000 hab.',
                status: seg02Count > 0 ? 'Completo' : 'Incompleto',
                source: 'Inferido - Narrativa',
                details: `${seg02Count} incidentes detectados por palabras clave`
            },
            {
                code: 'SEG-03',
                name: 'Percepción de Seguridad Ciudadana',
                frequency: 'Trimestral',
                value: null,
                rate: null,
                unit: '%',
                status: 'Pendiente',
                source: 'Manual - Encuesta',
                details: 'Requiere ingreso manual de datos de encuesta'
            },
            {
                code: 'SEG-04',
                name: 'Tiempo de Respuesta de Emergencias (911)',
                frequency: 'Mensual',
                value: null,
                rate: null,
                unit: 'minutos',
                status: 'Pendiente',
                source: 'Manual - Datos 911',
                details: 'Requiere ingreso manual de datos del 911'
            },
            {
                code: 'SEG-05',
                name: 'Programas de Prevención y Convivencia',
                frequency: 'Semestral',
                value: seg05Count,
                rate: null,
                unit: 'actividades',
                status: seg05Count > 0 ? 'Completo' : 'Incompleto',
                source: 'Automático - Forms',
                details: `${seg05Count} acciones preventivas registradas`
            }
        ]
    };
}

/**
 * API Endpoint: /api/ids/seguridad
 * Calcula y devuelve indicadores del pilar Seguridad
 */
app.get('/api/ids/seguridad', (req, res) => {
    try {
        const data = readExcelData();
        if (!data) {
            return res.status(404).json({
                error: 'Archivo Excel no encontrado',
                path: EXCEL_PATH
            });
        }

        // Calcular para diferentes períodos
        const monthly = calculateIndicators(data, 'monthly');
        const quarterly = calculateIndicators(data, 'quarterly');
        const semester = calculateIndicators(data, 'semester');
        const annual = calculateIndicators(data, 'annual');

        // Resumen general
        const summary = {
            total: 5,
            completo: monthly.indicators.filter(i => i.status === 'Completo').length,
            incompleto: monthly.indicators.filter(i => i.status === 'Incompleto').length,
            pendiente: monthly.indicators.filter(i => i.status === 'Pendiente').length
        };

        res.json({
            success: true,
            pilar: 'Seguridad',
            population: CJB_POPULATION,
            families: CJB_FAMILIES,
            lastUpdate: new Date().toISOString(),
            summary,
            periods: {
                monthly,
                quarterly,
                semester,
                annual
            }
        });

    } catch (error) {
        console.error('Error calculando indicadores IDS:', error);
        res.status(500).json({
            error: 'Error al calcular indicadores',
            details: error.message
        });
    }
});

/**
 * API Endpoint: /api/ids/export
 * Exporta indicadores a archivo Excel
 */
app.get('/api/ids/export', (req, res) => {
    try {
        const data = readExcelData();
        if (!data) {
            return res.status(404).json({ error: 'Archivo Excel no encontrado' });
        }

        const monthly = calculateIndicators(data, 'monthly');

        // Crear worksheet con indicadores
        const wsData = [
            ['Indicadores IDS - Pilar Seguridad'],
            ['Generado:', new Date().toLocaleDateString('es-DO', { dateStyle: 'full' })],
            ['Población CJB:', CJB_POPULATION],
            [],
            ['Código', 'Indicador', 'Frecuencia', 'Valor', 'Tasa', 'Unidad', 'Estado', 'Fuente', 'Detalles'],
            ...monthly.indicators.map(i => [
                i.code,
                i.name,
                i.frequency,
                i.value ?? 'N/A',
                i.rate ?? 'N/A',
                i.unit,
                i.status,
                i.source,
                i.details
            ])
        ];

        const ws = XLSX.utils.aoa_to_sheet(wsData);

        // Ajustar anchos de columna
        ws['!cols'] = [
            { wch: 10 }, { wch: 40 }, { wch: 12 }, { wch: 10 },
            { wch: 10 }, { wch: 15 }, { wch: 12 }, { wch: 20 }, { wch: 40 }
        ];

        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Indicadores Seguridad');

        // Generar buffer
        const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

        // Enviar archivo
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename=IDS_Seguridad_${new Date().toISOString().split('T')[0]}.xlsx`);
        res.send(buffer);

    } catch (error) {
        console.error('Error exportando indicadores:', error);
        res.status(500).json({
            error: 'Error al exportar indicadores',
            details: error.message
        });
    }
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
