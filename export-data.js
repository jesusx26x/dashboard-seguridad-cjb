/**
 * Script para exportar datos de Excel a JSON
 * Ejecutar: node export-data.js
 * 
 * Lee el archivo Excel de OneDrive y lo guarda como data.json
 * Luego haz git add, commit y push para que los usuarios de GitHub Pages vean los cambios
 */

const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');

// Ruta del archivo Excel local (en el directorio del proyecto)
const EXCEL_PATH = path.join(__dirname, 'Registro Rápido de Incidentes (SEGURIDAD).xlsx');

// Ruta donde guardar el JSON
const OUTPUT_PATH = path.join(__dirname, 'data.json');

console.log('');
console.log('==========================================');
console.log('  Exportador Excel → JSON');
console.log('==========================================');
console.log('');

try {
    // Verificar que el archivo existe
    if (!fs.existsSync(EXCEL_PATH)) {
        console.error('❌ ERROR: Archivo Excel no encontrado');
        console.error('   Ruta:', EXCEL_PATH);
        process.exit(1);
    }

    console.log('📂 Leyendo archivo Excel...');
    console.log('   ', EXCEL_PATH);

    // Leer el archivo Excel
    const workbook = XLSX.readFile(EXCEL_PATH);

    // Obtener la primera hoja
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];

    // Leer como array de arrays para tener control total
    // cellDates: true convierte las celdas de fecha a objetos Date de JS
    const rawData = XLSX.utils.sheet_to_json(worksheet, {
        header: 1,
        raw: false,
        defval: '',
        cellDates: true,
        dateNF: 'dd/mm/yyyy' // Hint para formateo si fuera necesario
    });

    console.log(`📊 Filas crudas encontradas: ${rawData.length}`);

    if (rawData.length < 2) {
        console.error('❌ Error: El archivo parece estar vacío o solo tiene cabecera');
        process.exit(1);
    }

    // Extraer cabeceras y datos
    const headers = rawData[0];
    const rows = rawData.slice(1);

    // Helper para formatear fechas a DD/MM/YYYY HH:mm
    const formatDate = (val) => {
        if (val instanceof Date) {
            const day = val.getDate().toString().padStart(2, '0');
            const month = (val.getMonth() + 1).toString().padStart(2, '0');
            const year = val.getFullYear();
            const hours = val.getHours().toString().padStart(2, '0');
            const minutes = val.getMinutes().toString().padStart(2, '0');
            return `${day}/${month}/${year} ${hours}:${minutes}`;
        }
        return val; // Devolver tal cual si no es fecha
    };

    // Convertir a objetos
    const data = rows.map(row => {
        const obj = {};
        headers.forEach((header, index) => {
            let val = row[index];
            // Si es null/undefined, usar string vacio
            if (val === null || val === undefined) val = '';

            // Formatear si es fecha
            val = formatDate(val);

            obj[header] = val;
        });
        return obj;
    }).filter(obj => {
        // Filtrar filas totalmente vacías
        return Object.values(obj).some(val => val !== '' && val !== null && val !== undefined);
    });

    console.log(`✅ ${data.length} registros leídos`);

    // Crear objeto con metadatos
    const output = {
        lastUpdate: new Date().toISOString(),
        count: data.length,
        data: data
    };

    // Guardar como JSON
    fs.writeFileSync(OUTPUT_PATH, JSON.stringify(output, null, 2), 'utf8');

    console.log('');
    console.log('✅ Archivo exportado exitosamente:');
    console.log('   ', OUTPUT_PATH);
    console.log('');
    console.log('==========================================');
    console.log('  PRÓXIMOS PASOS:');
    console.log('==========================================');
    console.log('  1. git add data.json');
    console.log('  2. git commit -m "Actualizar datos"');
    console.log('  3. git push');
    console.log('');
    console.log('  Los usuarios de GitHub Pages verán los');
    console.log('  datos actualizados en unos minutos.');
    console.log('==========================================');
    console.log('');

} catch (error) {
    console.error('❌ ERROR:', error.message);
    process.exit(1);
}
