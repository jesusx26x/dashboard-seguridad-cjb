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

// Ruta del archivo Excel en OneDrive sincronizado
const EXCEL_PATH = 'C:\\Users\\Lenovo\\OneDrive - Fideicomiso VBCRD\\Data Formularios\\Registro Rápido de Incidentes (SEGURIDAD).xlsx';

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

    // Convertir a JSON
    const data = XLSX.utils.sheet_to_json(worksheet, {
        raw: false,
        defval: ''
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
