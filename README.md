# 🛡️ Dashboard de Incidentes de Seguridad - Ciudad Juan Bosch

<p align="center">
  <img src="logo-cjb.png" alt="Logo CJB" width="120">
</p>

<p align="center">
  <strong>Dashboard interactivo tipo Power BI para la gestión de incidentes de seguridad</strong>
</p>

<p align="center">
  <a href="#características">Características</a> •
  <a href="#demo">Demo</a> •
  <a href="#instalación">Instalación</a> •
  <a href="#uso">Uso</a> •
  <a href="#tecnologías">Tecnologías</a>
</p>

---

## 📋 Descripción

Dashboard web interactivo desarrollado para la **Dirección de Seguridad de Ciudad Juan Bosch (CJB)**. Permite visualizar, analizar y exportar datos de incidentes de seguridad con una experiencia similar a Power BI.

### 🎯 Objetivo

Proporcionar a los oficiales y directivos una herramienta visual para:
- Monitorear incidentes en tiempo real
- Identificar patrones y tendencias
- Filtrar datos de manera interactiva
- Generar reportes ejecutivos

---

## ✨ Características

### 📊 Visualizaciones Interactivas
- **11 gráficos dinámicos** con Chart.js
- **6 KPIs** que se actualizan en tiempo real
- **Cross-filtering**: clic en un gráfico filtra todos los demás

### 🎛️ Navegación SPA
- **4 secciones**: Dashboard, Incidentes, Análisis Avanzado, Reportes
- Navegación fluida sin recarga de página

### 🔍 Filtros Avanzados
- Por rango de fechas
- Por tipo de incidente
- Por cuadrante geográfico
- Por oficial a cargo
- Búsqueda de texto libre

### 📤 Exportación
- **Excel (.xlsx)**: datos filtrados
- **PDF**: captura del dashboard
- **Resumen Ejecutivo**: modal con métricas clave

---

## 🖼️ Demo

### Dashboard Principal
El dashboard muestra KPIs, gráficos de barras, donut, líneas y más.

### Análisis Avanzado
Visualizaciones de patrones por día de la semana, mes, hora y rendimiento de oficiales.

---

## 🚀 Instalación

### Requisitos
- Navegador web moderno (Chrome, Firefox, Edge, Safari)
- No requiere servidor (funciona localmente)

### Pasos

1. **Clonar el repositorio**
```bash
git clone https://github.com/[tu-usuario]/dashboard-seguridad-cjb.git
```

2. **Abrir el archivo**
```bash
cd dashboard-seguridad-cjb
start index.html  # Windows
open index.html   # macOS
```

---

## 📖 Uso

### 1. Cargar Datos
- Arrastra un archivo **CSV** o **Excel** a la zona de carga
- También puedes usar el botón "Seleccionar Archivo"

### 2. Explorar Dashboard
- Los KPIs se calculan automáticamente
- **Haz clic en cualquier gráfico** para filtrar todos los datos

### 3. Navegar Secciones
- **Dashboard**: Métricas y gráficos principales
- **Incidentes**: Tabla detallada con búsqueda
- **Análisis**: Patrones por hora, día y mes
- **Reportes**: Exportar a Excel/PDF

### 4. Limpiar Filtros
- Usa el botón "Limpiar Filtros" para reiniciar la vista

---

## 🔧 Formato de Datos

El archivo CSV/Excel debe contener las siguientes columnas:

| Columna | Descripción | Ejemplo |
|---------|-------------|---------|
| Id | Identificador único | 1, 2, 3... |
| Hora de inicio | Fecha y hora | 15/12/2025 14:30 |
| Oficial a cargo | Nombre del oficial | "Juan Pérez" |
| Tipo de Incidente | Categoría | "Migración", "DIGESETT" |
| Cuadrante donde sucedió el hecho | Zona | "A", "B", "C" |
| Cantidad de Indocumentados detenidos | Número | 0, 1, 2... |
| Narrativa del Incidente | Descripción | "Texto libre..." |
| Acciones Tomadas | Resolución | "Arresto", "Advertencia" |

---

## 💻 Tecnologías

| Tecnología | Uso |
|------------|-----|
| ![HTML5](https://img.shields.io/badge/HTML5-E34F26?style=flat&logo=html5&logoColor=white) | Estructura |
| ![CSS3](https://img.shields.io/badge/CSS3-1572B6?style=flat&logo=css3&logoColor=white) | Estilos |
| ![JavaScript](https://img.shields.io/badge/JavaScript-F7DF1E?style=flat&logo=javascript&logoColor=black) | Lógica |
| ![Chart.js](https://img.shields.io/badge/Chart.js-FF6384?style=flat&logo=chartdotjs&logoColor=white) | Gráficos |
| Papa Parse | Parsing CSV |
| SheetJS | Excel I/O |
| html2pdf.js | Exportación PDF |
| Font Awesome | Iconos |

---

## 📁 Estructura del Proyecto

```
📦 Dashboard Seguridad
 ├── 📄 index.html           # Página principal
 ├── 📄 styles.css           # Estilos (1900+ líneas)
 ├── 📄 app.js               # Lógica JavaScript (1600+ líneas)
 ├── 📄 logo-cjb.png         # Logo
 ├── 📄 README.md            # Este archivo
 ├── 📄 Project_Tracker.md   # Historial de cambios
 └── 📄 Registro Rápido de Incidentes (SEGURIDAD).csv  # Datos ejemplo
```

---

## 🏗️ Arquitectura

```
┌─────────────────────────────────────────────────────┐
│                    index.html                        │
│              (Estructura HTML + SPA)                 │
└─────────────────────────────────────────────────────┘
                         │
         ┌───────────────┼───────────────┐
         ▼               ▼               ▼
┌─────────────┐  ┌─────────────┐  ┌─────────────┐
│ styles.css  │  │   app.js    │  │ Librerías   │
│   (UI/UX)   │  │  (Lógica)   │  │   (CDN)     │
└─────────────┘  └─────────────┘  └─────────────┘
                         │
         ┌───────────────┼───────────────┐
         ▼               ▼               ▼
┌─────────────┐  ┌─────────────┐  ┌─────────────┐
│  DataStore  │  │ ChartManager│  │ UIManager   │
│  (Datos)    │  │ (Gráficos)  │  │ (Interfaz)  │
└─────────────┘  └─────────────┘  └─────────────┘
         │               │               │
         └───────────────┼───────────────┘
                         ▼
              ┌─────────────────────┐
              │      EventBus       │
              │ (Comunicación)      │
              └─────────────────────┘
```

---

## 👥 Créditos

Desarrollado para la **Dirección de Seguridad de Ciudad Juan Bosch**

---

## 📄 Licencia

Este proyecto es de uso interno para Ciudad Juan Bosch.

---

<p align="center">
  <sub>Hecho con ❤️ para la seguridad de nuestra comunidad</sub>
</p>
