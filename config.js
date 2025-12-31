/**
 * Configuración del Dashboard CJB
 * ================================
 * Modifica estos valores según tu entorno
 */

const CONFIG = {
    // URL del archivo Excel en SharePoint (con &download=1 para descarga directa)
    SHAREPOINT_URL: 'https://vbcrd-my.sharepoint.com/:x:/g/personal/jesusdelossantos_vbc_gob_do/IQCbhrkDR0u2Q5KenioSh3eeAczGCtQiJzb22PSfPfTNqLo?e=SR2odg&download=1',

    // URL de respaldo en GitHub (siempre disponible)
    GITHUB_DATA_URL: 'https://raw.githubusercontent.com/jesusx26x/dashboard-seguridad-cjb/main/data.json',

    // Cargar automáticamente desde SharePoint al iniciar
    AUTO_LOAD_FROM_CLOUD: true,

    // Intervalo de actualización automática (en minutos, 0 = desactivado)
    AUTO_REFRESH_MINUTES: 5,

    // Mostrar botón de carga manual aunque esté configurado auto-load
    SHOW_MANUAL_UPLOAD: true
};
