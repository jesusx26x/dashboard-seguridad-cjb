/**
 * Configuración del Dashboard CJB
 * ================================
 * Modifica estos valores según tu entorno
 */

const CONFIG = {
    // URL del archivo Excel en SharePoint (con &download=1 para descarga directa)
    SHAREPOINT_URL: 'https://vbcrd-my.sharepoint.com/:x:/g/personal/jesusdelossantos_vbc_gob_do/IQCbhrkDR0u2Q5KenioSh3eeAczGCtQiJzb22PSfPfTNqLo?e=hoU6Bb&download=1',

    // Cargar automáticamente desde SharePoint al iniciar
    AUTO_LOAD_FROM_CLOUD: true,

    // Intervalo de actualización automática (en minutos, 0 = desactivado)
    AUTO_REFRESH_MINUTES: 0,

    // Mostrar botón de carga manual aunque esté configurado auto-load
    SHOW_MANUAL_UPLOAD: true
};
