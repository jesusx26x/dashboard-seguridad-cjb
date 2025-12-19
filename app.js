/**
 * Dashboard de Incidentes CJB - Power BI Edition
 * JavaScript Principal v3.0
 * =====================================================
 * Features:
 * - Centralized DataStore
 * - Cross-filtering between charts
 * - SPA Navigation
 * - Dynamic KPIs
 */

// ============================================
// CENTRALIZED DATA STORE (Simulated Database)
// ============================================
const DataStore = {
    // Raw data from file
    rawData: [],

    // Currently filtered data (after cross-filters applied)
    filteredData: [],

    // Active cross-filters
    crossFilters: {
        type: null,
        quadrant: null,
        officer: null,
        hour: null,
        dayOfWeek: null,
        month: null,
        action: null
    },

    // Filter by dropdown values
    dropdownFilters: {
        dateFrom: null,
        dateTo: null,
        type: null,
        quadrant: null,
        officer: null,
        search: ''
    },

    // Load data into store
    load(data) {
        this.rawData = data;
        this.filteredData = [...data];
        this.clearAllFilters();
        EventBus.emit('dataLoaded', data);
    },

    // Apply all filters and return filtered data
    applyFilters() {
        let result = [...this.rawData];

        // Apply dropdown filters
        const df = this.dropdownFilters;

        if (df.dateFrom) {
            result = result.filter(r => r.date && r.date >= df.dateFrom);
        }
        if (df.dateTo) {
            const dateTo = new Date(df.dateTo);
            dateTo.setHours(23, 59, 59);
            result = result.filter(r => r.date && r.date <= dateTo);
        }
        if (df.type) {
            result = result.filter(r => r.type === df.type);
        }
        if (df.quadrant) {
            result = result.filter(r => r.quadrant === df.quadrant);
        }
        if (df.officer) {
            result = result.filter(r => r.officer === df.officer);
        }
        if (df.search) {
            const search = df.search.toLowerCase();
            result = result.filter(r => {
                const fields = [r.id, r.type, r.quadrant, r.officer, r.narrative, r.actions, r.personName].join(' ').toLowerCase();
                return fields.includes(search);
            });
        }

        // Apply cross-filters (Power BI style)
        const cf = this.crossFilters;

        if (cf.type) {
            result = result.filter(r => r.type === cf.type);
        }
        if (cf.quadrant) {
            result = result.filter(r => r.quadrant === cf.quadrant);
        }
        if (cf.officer) {
            result = result.filter(r => r.officer === cf.officer);
        }
        if (cf.hour !== null) {
            result = result.filter(r => r.date && r.date.getHours() === cf.hour);
        }
        if (cf.dayOfWeek !== null) {
            result = result.filter(r => r.date && r.date.getDay() === cf.dayOfWeek);
        }
        if (cf.month !== null) {
            result = result.filter(r => r.date && r.date.getMonth() === cf.month);
        }
        if (cf.action) {
            result = result.filter(r => r.actions && r.actions.toLowerCase().includes(cf.action.toLowerCase()));
        }

        this.filteredData = result;
        return result;
    },

    // Set cross filter
    setCrossFilter(key, value) {
        // Toggle if same value
        if (this.crossFilters[key] === value) {
            this.crossFilters[key] = null;
        } else {
            this.crossFilters[key] = value;
        }
        this.applyFilters();
        EventBus.emit('filtersChanged', this.getActiveFilters());
    },

    // Set dropdown filter
    setDropdownFilter(key, value) {
        this.dropdownFilters[key] = value || null;
        this.applyFilters();
        EventBus.emit('filtersChanged', this.getActiveFilters());
    },

    // Clear all filters
    clearAllFilters() {
        this.crossFilters = {
            type: null, quadrant: null, officer: null,
            hour: null, dayOfWeek: null, month: null, action: null
        };
        this.dropdownFilters = {
            dateFrom: null, dateTo: null, type: null,
            quadrant: null, officer: null, search: ''
        };
        this.filteredData = [...this.rawData];
        EventBus.emit('filtersCleared');
    },

    // Get count of active filters
    getActiveFilters() {
        let count = 0;
        const active = [];

        for (const [key, val] of Object.entries(this.crossFilters)) {
            if (val !== null) {
                count++;
                active.push({ type: 'cross', key, value: val });
            }
        }
        for (const [key, val] of Object.entries(this.dropdownFilters)) {
            if (val && key !== 'search') {
                count++;
                active.push({ type: 'dropdown', key, value: val });
            }
        }
        return { count, active };
    },

    // Get aggregations
    getAggregations() {
        const data = this.filteredData;
        return {
            total: data.length,
            undocumented: data.reduce((sum, r) => sum + (r.undocumented || 0), 0),
            accidents: data.filter(r => this.isAccident(r)).length,
            arrests: data.filter(r => this.isArrest(r)).length,
            officers: new Set(data.map(r => r.officer).filter(o => o && o !== 'No especificado')).size,
            closures: data.filter(r => this.isClosure(r)).length
        };
    },

    isAccident(r) {
        return r.type?.toLowerCase().includes('digesett') ||
            r.transitIncident?.toLowerCase().includes('accidente') ||
            r.narrative?.toLowerCase().includes('accidente');
    },

    isArrest(r) {
        return r.actions?.toLowerCase().includes('arresto') ||
            r.actions?.toLowerCase().includes('detención') ||
            r.actions?.toLowerCase().includes('detencion');
    },

    isClosure(r) {
        return r.actions?.toLowerCase().includes('clausura') ||
            r.narrative?.toLowerCase().includes('clausura');
    },

    // Group by field
    groupBy(field) {
        const groups = {};
        this.filteredData.forEach(row => {
            const key = row[field] || 'No especificado';
            groups[key] = (groups[key] || 0) + 1;
        });
        return Object.entries(groups).sort((a, b) => b[1] - a[1]);
    },

    // Group by hour
    groupByHour() {
        const hours = {};
        for (let i = 0; i < 24; i++) hours[i] = 0;
        this.filteredData.forEach(row => {
            if (row.date) hours[row.date.getHours()]++;
        });
        return hours;
    },

    // Group by day of week
    groupByDayOfWeek() {
        const days = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 };
        this.filteredData.forEach(row => {
            if (row.date) days[row.date.getDay()]++;
        });
        return days;
    },

    // Timeline aggregation
    groupByPeriod(period = 'daily') {
        const groups = {};
        this.filteredData.forEach(row => {
            if (!row.date) return;
            let key;
            if (period === 'daily') {
                key = formatDateForInput(row.date);
            } else if (period === 'weekly') {
                const week = getWeekNumber(row.date);
                key = `${row.date.getFullYear()}-S${week.toString().padStart(2, '0')}`;
            } else {
                key = `${row.date.getFullYear()}-${(row.date.getMonth() + 1).toString().padStart(2, '0')}`;
            }
            groups[key] = (groups[key] || 0) + 1;
        });
        return Object.entries(groups).sort((a, b) => a[0].localeCompare(b[0]));
    }
};

// ============================================
// EVENT BUS (For Cross-Component Communication)
// ============================================
const EventBus = {
    events: {},

    on(event, callback) {
        if (!this.events[event]) this.events[event] = [];
        this.events[event].push(callback);
    },

    emit(event, data) {
        if (this.events[event]) {
            this.events[event].forEach(cb => cb(data));
        }
    },

    off(event, callback) {
        if (this.events[event]) {
            this.events[event] = this.events[event].filter(cb => cb !== callback);
        }
    }
};

// ============================================
// SPA NAVIGATION
// ============================================
const Navigation = {
    currentPage: 'uploadSection',

    init() {
        document.querySelectorAll('.nav-item[data-page]').forEach(item => {
            item.addEventListener('click', (e) => {
                e.preventDefault();
                const page = item.dataset.page;
                if (DataStore.rawData.length === 0 && page !== 'uploadSection') {
                    // Show modal warning instead of toast
                    showConfirm(
                        '📂 Archivo Requerido',
                        'Debe cargar un archivo de datos para acceder a esta sección. ¿Desea ir a la zona de carga?',
                        () => {
                            showUploadSection();
                        }
                    );
                    return;
                }
                this.navigateTo(page);
            });
        });
    },

    navigateTo(pageId) {
        // Hide all pages
        document.querySelectorAll('.page-section').forEach(p => p.style.display = 'none');

        // Show target page
        const target = document.getElementById(pageId);
        if (target) {
            target.style.display = 'block';
            this.currentPage = pageId;

            // Update nav active state
            document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
            const activeNav = document.querySelector(`.nav-item[data-page="${pageId}"]`);
            if (activeNav) activeNav.classList.add('active');

            // Update page title
            this.updatePageTitle(pageId);

            // Trigger page-specific renders
            EventBus.emit('pageChanged', pageId);
        }
    },

    updatePageTitle(pageId) {
        const titles = {
            dashboardPage: { title: 'Dashboard de Incidentes', subtitle: 'Visualización interactiva tipo Power BI' },
            incidentsPage: { title: 'Registro de Incidentes', subtitle: 'Listado completo y búsqueda' },
            analyticsPage: { title: 'Análisis Avanzado', subtitle: 'Patrones y tendencias' },
            reportsPage: { title: 'Centro de Reportes', subtitle: 'Generación y exportación' }
        };
        const t = titles[pageId] || { title: 'Dashboard', subtitle: '' };
        document.getElementById('pageTitle').textContent = t.title;
        document.getElementById('pageSubtitle').textContent = t.subtitle;
    },

    showDashboard() {
        this.navigateTo('dashboardPage');
    }
};

// ============================================
// CHART MANAGER (With Cross-Filter Events)
// ============================================
const ChartManager = {
    charts: {},
    timelinePeriod: 'daily',

    init() {
        Chart.defaults.font.family = "'Inter', sans-serif";
        Chart.defaults.color = '#7f8c8d';
        Chart.defaults.plugins.legend.labels.usePointStyle = true;

        // Timeline period buttons
        document.querySelectorAll('.chart-btn[data-period]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.querySelectorAll('.chart-btn[data-period]').forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
                this.timelinePeriod = e.target.dataset.period;
                this.renderTimeline();
            });
        });
    },

    renderAll() {
        this.renderByType();
        this.renderByQuadrant();
        this.renderTimeline();
        this.renderByOfficer();
        this.renderActions();
        this.renderUndocByQuadrant();
        this.renderByHour();
    },

    renderAnalytics() {
        this.renderByDayOfWeek();
        this.renderMonthlyComparison();
        this.renderHeatmap();
        this.renderOfficerPerformance();
    },

    destroyAll() {
        Object.values(this.charts).forEach(c => c?.destroy?.());
        this.charts = {};
    },

    // ---- CHART: By Type (Clickable) ----
    renderByType() {
        const ctx = document.getElementById('chartByType');
        if (!ctx) return;

        const grouped = DataStore.groupBy('type');
        const labels = grouped.map(g => g[0]);
        const data = grouped.map(g => g[1]);

        if (this.charts.byType) this.charts.byType.destroy();

        this.charts.byType = new Chart(ctx.getContext('2d'), {
            type: 'bar',
            data: {
                labels,
                datasets: [{
                    label: 'Incidentes',
                    data,
                    backgroundColor: this.generateColors(labels.length, 0.8),
                    borderWidth: 0,
                    borderRadius: 6
                }]
            },
            options: {
                indexAxis: 'y',
                responsive: true,
                maintainAspectRatio: false,
                onClick: (evt, elements) => {
                    if (elements.length > 0) {
                        const idx = elements[0].index;
                        DataStore.setCrossFilter('type', labels[idx]);
                    }
                },
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                            label: (ctx) => {
                                const pct = ((ctx.parsed.x / DataStore.filteredData.length) * 100).toFixed(1);
                                return `${ctx.parsed.x} (${pct}%)`;
                            }
                        }
                    },
                    datalabels: {
                        color: 'white',
                        font: { weight: 'bold' },
                        anchor: 'center',
                        align: 'center',
                        formatter: (val) => val > 0 ? val : ''
                    }
                },
                scales: {
                    x: { beginAtZero: true, grid: { color: 'rgba(0,0,0,0.05)' } },
                    y: { grid: { display: false } }
                }
            },
            plugins: [ChartDataLabels]
        });
    },

    // ---- CHART: By Quadrant (Clickable) ----
    renderByQuadrant() {
        const ctx = document.getElementById('chartByQuadrant');
        if (!ctx) return;

        const grouped = DataStore.groupBy('quadrant').filter(g => g[0] !== 'No especificado');
        const labels = grouped.map(g => g[0]);
        const data = grouped.map(g => g[1]);

        if (this.charts.byQuadrant) this.charts.byQuadrant.destroy();

        this.charts.byQuadrant = new Chart(ctx.getContext('2d'), {
            type: 'doughnut',
            data: {
                labels,
                datasets: [{
                    data,
                    backgroundColor: this.getQuadrantColors(),
                    borderWidth: 2,
                    borderColor: '#fff'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                onClick: (evt, elements) => {
                    if (elements.length > 0) {
                        const idx = elements[0].index;
                        DataStore.setCrossFilter('quadrant', labels[idx]);
                    }
                },
                plugins: {
                    legend: { position: 'right' },
                    datalabels: {
                        color: '#fff',
                        font: { weight: 'bold' },
                        formatter: (val, ctx) => {
                            let sum = 0;
                            let dataArr = ctx.chart.data.datasets[0].data;
                            dataArr.map(data => { sum += data; });
                            let percentage = (val * 100 / sum).toFixed(1) + "%";
                            return percentage;
                        }
                    }
                },
                cutout: '60%'
            },
            plugins: [ChartDataLabels]
        });
    },

    // ---- CHART: Timeline ----
    renderTimeline() {
        const ctx = document.getElementById('chartTimeline');
        if (!ctx) return;

        const grouped = DataStore.groupByPeriod(this.timelinePeriod);
        const labels = grouped.map(g => formatPeriodLabel(g[0], this.timelinePeriod));
        const data = grouped.map(g => g[1]);

        if (this.charts.timeline) this.charts.timeline.destroy();

        this.charts.timeline = new Chart(ctx.getContext('2d'), {
            type: 'line',
            data: {
                labels,
                datasets: [{
                    label: 'Incidentes',
                    data,
                    borderColor: 'rgba(46, 204, 113, 1)',
                    backgroundColor: 'rgba(46, 204, 113, 0.1)',
                    fill: true,
                    tension: 0.4,
                    pointRadius: 4,
                    pointHoverRadius: 6
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: {
                    x: { grid: { display: false } },
                    y: { beginAtZero: true, grid: { color: 'rgba(0,0,0,0.05)' } }
                },
                interaction: { intersect: false, mode: 'index' }
            }
        });
    },

    // ---- CHART: By Officer (Clickable) ----
    renderByOfficer() {
        const ctx = document.getElementById('chartByOfficer');
        if (!ctx) return;

        const grouped = DataStore.groupBy('officer')
            .filter(g => g[0] !== 'No especificado')
            .slice(0, 10);
        const labels = grouped.map(g => truncateLabel(g[0], 25));
        const fullLabels = grouped.map(g => g[0]);
        const data = grouped.map(g => g[1]);

        if (this.charts.byOfficer) this.charts.byOfficer.destroy();

        this.charts.byOfficer = new Chart(ctx.getContext('2d'), {
            type: 'bar',
            data: {
                labels,
                datasets: [{
                    label: 'Incidentes',
                    data,
                    backgroundColor: 'rgba(52, 152, 219, 0.8)',
                    borderRadius: 6
                }]
            },
            options: {
                indexAxis: 'y',
                responsive: true,
                maintainAspectRatio: false,
                onClick: (evt, elements) => {
                    if (elements.length > 0) {
                        const idx = elements[0].index;
                        DataStore.setCrossFilter('officer', fullLabels[idx]);
                    }
                },
                plugins: {
                    legend: { display: false },
                    datalabels: {
                        color: 'white',
                        anchor: 'end',
                        align: 'end',
                        offset: -30,
                        font: { weight: 'bold' }
                    }
                },
                scales: {
                    x: { beginAtZero: true, grid: { color: 'rgba(0,0,0,0.05)' } },
                    y: { grid: { display: false } }
                }
            },
            plugins: [ChartDataLabels]
        });
    },

    // ---- CHART: Actions (Clickable) ----
    renderActions() {
        const ctx = document.getElementById('chartActions');
        if (!ctx) return;

        const actionCounts = {};
        DataStore.filteredData.forEach(row => {
            if (row.actions) {
                const acts = row.actions.split(/[;,]/).map(a => a.trim()).filter(a => a.length > 3);
                acts.forEach(a => {
                    const norm = normalizeAction(a);
                    if (norm) actionCounts[norm] = (actionCounts[norm] || 0) + 1;
                });
            }
        });

        const sorted = Object.entries(actionCounts).sort((a, b) => b[1] - a[1]).slice(0, 8);
        const labels = sorted.map(s => s[0]);
        const data = sorted.map(s => s[1]);

        if (this.charts.actions) this.charts.actions.destroy();

        this.charts.actions = new Chart(ctx.getContext('2d'), {
            type: 'polarArea',
            data: {
                labels,
                datasets: [{ data, backgroundColor: this.generateColors(labels.length, 0.7) }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                onClick: (evt, elements) => {
                    if (elements.length > 0) {
                        const idx = elements[0].index;
                        DataStore.setCrossFilter('action', labels[idx]);
                    }
                },
                plugins: {
                    legend: { position: 'right', labels: { font: { size: 11 } } }
                }
            }
        });
    },

    // ---- CHART: Undocumented by Quadrant ----
    renderUndocByQuadrant() {
        const ctx = document.getElementById('chartUndocByQuadrant');
        if (!ctx) return;

        const undocByQ = {};
        DataStore.filteredData.forEach(row => {
            if (row.quadrant && row.quadrant !== 'No especificado' && row.undocumented > 0) {
                undocByQ[row.quadrant] = (undocByQ[row.quadrant] || 0) + row.undocumented;
            }
        });

        const labels = Object.keys(undocByQ).sort();
        const data = labels.map(q => undocByQ[q]);

        if (this.charts.undocByQuadrant) this.charts.undocByQuadrant.destroy();

        this.charts.undocByQuadrant = new Chart(ctx.getContext('2d'), {
            type: 'bar',
            data: {
                labels,
                datasets: [{
                    label: 'Indocumentados',
                    data,
                    backgroundColor: 'rgba(243, 156, 18, 0.8)',
                    borderRadius: 6
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                onClick: (evt, elements) => {
                    if (elements.length > 0) {
                        const idx = elements[0].index;
                        DataStore.setCrossFilter('quadrant', labels[idx]);
                    }
                },
                plugins: {
                    legend: { display: false },
                    datalabels: {
                        color: 'white',
                        anchor: 'end',
                        align: 'start', // Inside bar
                        font: { weight: 'bold' }
                    }
                },
                scales: {
                    x: { grid: { display: false } },
                    y: { beginAtZero: true, grid: { color: 'rgba(0,0,0,0.05)' } }
                }
            },
            plugins: [ChartDataLabels]
        });
    },

    // ---- CHART: By Hour (Clickable) ----
    renderByHour() {
        const ctx = document.getElementById('chartByHour');
        if (!ctx) return;

        const hours = DataStore.groupByHour();
        const labels = Object.keys(hours).map(h => `${h.toString().padStart(2, '0')}:00`);
        const data = Object.values(hours);

        if (this.charts.byHour) this.charts.byHour.destroy();

        this.charts.byHour = new Chart(ctx.getContext('2d'), {
            type: 'bar',
            data: {
                labels,
                datasets: [{
                    label: 'Incidentes',
                    data,
                    backgroundColor: this.generateGradientColors(24),
                    borderRadius: 4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                onClick: (evt, elements) => {
                    if (elements.length > 0) {
                        const idx = elements[0].index;
                        DataStore.setCrossFilter('hour', idx);
                    }
                },
                plugins: { legend: { display: false } },
                scales: {
                    x: { grid: { display: false } },
                    y: { beginAtZero: true, grid: { color: 'rgba(0,0,0,0.05)' } }
                }
            }
        });
    },

    // ---- ANALYTICS CHARTS ----
    renderByDayOfWeek() {
        const ctx = document.getElementById('chartByDayOfWeek');
        if (!ctx) return;

        const days = DataStore.groupByDayOfWeek();
        const labels = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
        const data = Object.values(days);

        if (this.charts.byDayOfWeek) this.charts.byDayOfWeek.destroy();

        this.charts.byDayOfWeek = new Chart(ctx.getContext('2d'), {
            type: 'bar',
            data: {
                labels,
                datasets: [{
                    label: 'Incidentes',
                    data,
                    backgroundColor: this.generateColors(7, 0.8),
                    borderRadius: 8
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                onClick: (evt, elements) => {
                    if (elements.length > 0) {
                        DataStore.setCrossFilter('dayOfWeek', elements[0].index);
                    }
                },
                plugins: { legend: { display: false } },
                scales: {
                    x: { grid: { display: false } },
                    y: { beginAtZero: true }
                }
            }
        });
    },

    renderMonthlyComparison() {
        const ctx = document.getElementById('chartMonthlyComparison');
        if (!ctx) return;

        const monthly = {};
        DataStore.filteredData.forEach(row => {
            if (row.date) {
                const month = row.date.getMonth();
                monthly[month] = (monthly[month] || 0) + 1;
            }
        });

        const monthNames = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
        const data = monthNames.map((_, i) => monthly[i] || 0);

        if (this.charts.monthlyComparison) this.charts.monthlyComparison.destroy();

        this.charts.monthlyComparison = new Chart(ctx.getContext('2d'), {
            type: 'line',
            data: {
                labels: monthNames,
                datasets: [{
                    label: 'Incidentes',
                    data,
                    borderColor: 'rgba(155, 89, 182, 1)',
                    backgroundColor: 'rgba(155, 89, 182, 0.2)',
                    fill: true,
                    tension: 0.4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                onClick: (evt, elements) => {
                    if (elements.length > 0) {
                        DataStore.setCrossFilter('month', elements[0].index);
                    }
                },
                plugins: { legend: { display: false } }
            }
        });
    },

    renderHeatmap() {
        const ctx = document.getElementById('chartHeatmap');
        if (!ctx) return;

        // Build heatmap data
        const heatData = [];
        const days = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

        for (let d = 0; d < 7; d++) {
            for (let h = 0; h < 24; h++) {
                const count = DataStore.filteredData.filter(r =>
                    r.date && r.date.getDay() === d && r.date.getHours() === h
                ).length;
                heatData.push({ x: h, y: d, v: count });
            }
        }

        if (this.charts.heatmap) this.charts.heatmap.destroy();

        // Stacked Bar for Hour x Day
        const hourLabels = Array.from({ length: 24 }, (_, i) => `${i}:00`);
        const datasets = days.map((day, dayIdx) => ({
            label: day,
            data: hourLabels.map((_, h) => heatData.find(d => d.x === h && d.y === dayIdx)?.v || 0),
            backgroundColor: this.generateColors(7, 0.7)[dayIdx],
            stack: 'Stack 0'
        }));

        this.charts.heatmap = new Chart(ctx.getContext('2d'), {
            type: 'bar',
            data: { labels: hourLabels, datasets },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { position: 'top' },
                    datalabels: { display: false } // Too crowded
                },
                scales: {
                    x: { stacked: true, grid: { display: false }, title: { display: true, text: 'Hora del Día' } },
                    y: { stacked: true, beginAtZero: true, title: { display: true, text: 'Cantidad' } }
                }
            },
            plugins: [ChartDataLabels]
        });
    },

    renderOfficerPerformance() {
        const ctx = document.getElementById('chartOfficerPerformance');
        if (!ctx) return;

        const perf = {};
        DataStore.filteredData.forEach(row => {
            if (row.officer && row.officer !== 'No especificado') {
                if (!perf[row.officer]) perf[row.officer] = { incidents: 0, undoc: 0 };
                perf[row.officer].incidents++;
                perf[row.officer].undoc += row.undocumented || 0;
            }
        });

        const sorted = Object.entries(perf)
            .sort((a, b) => b[1].undoc - a[1].undoc)
            .slice(0, 15);

        const labels = sorted.map(s => truncateLabel(s[0], 20));
        const incidentsData = sorted.map(s => s[1].incidents);
        const undocData = sorted.map(s => s[1].undoc);

        if (this.charts.officerPerformance) this.charts.officerPerformance.destroy();

        this.charts.officerPerformance = new Chart(ctx.getContext('2d'), {
            type: 'bar',
            data: {
                labels,
                datasets: [
                    { label: 'Incidentes', data: incidentsData, backgroundColor: 'rgba(52, 152, 219, 0.8)' },
                    { label: 'Indocumentados', data: undocData, backgroundColor: 'rgba(243, 156, 18, 0.8)' }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                indexAxis: 'y',
                plugins: { legend: { position: 'top' } },
                scales: {
                    x: { beginAtZero: true },
                    y: { grid: { display: false } }
                }
            }
        });
    },

    // Helper methods
    generateColors(count, alpha) {
        const colors = [
            `rgba(30, 58, 95, ${alpha})`, `rgba(46, 204, 113, ${alpha})`,
            `rgba(52, 152, 219, ${alpha})`, `rgba(155, 89, 182, ${alpha})`,
            `rgba(243, 156, 18, ${alpha})`, `rgba(231, 76, 60, ${alpha})`,
            `rgba(26, 188, 156, ${alpha})`, `rgba(241, 196, 15, ${alpha})`,
            `rgba(230, 126, 34, ${alpha})`, `rgba(149, 165, 166, ${alpha})`
        ];
        return Array.from({ length: count }, (_, i) => colors[i % colors.length]);
    },

    generateGradientColors(count) {
        return Array.from({ length: count }, (_, i) => `hsla(${(i / count) * 240}, 70%, 55%, 0.8)`);
    },

    getQuadrantColors() {
        return ['rgba(30,58,95,0.8)', 'rgba(46,204,113,0.8)', 'rgba(52,152,219,0.8)',
            'rgba(155,89,182,0.8)', 'rgba(243,156,18,0.8)', 'rgba(231,76,60,0.8)'];
    }
};

// ============================================
// UI MANAGER (KPIs, Filters, Badges)
// ============================================
const UIManager = {
    init() {
        this.createToastContainer();
        this.createConfirmModal();
        this.bindFilterEvents();
        this.bindGlobalButtons();
    },

    createToastContainer() {
        if (!document.getElementById('toastContainer')) {
            const container = document.createElement('div');
            container.id = 'toastContainer';
            container.className = 'toast-container';
            document.body.appendChild(container);
        }
    },

    createConfirmModal() {
        if (!document.getElementById('confirmModal')) {
            const modal = document.createElement('div');
            modal.id = 'confirmModal';
            modal.className = 'confirm-modal';
            modal.innerHTML = `
                <div class="confirm-modal-content">
                    <div class="confirm-modal-header">
                        <i class="fas fa-question-circle"></i>
                        <h3 id="confirmTitle">Confirmar</h3>
                    </div>
                    <div class="confirm-modal-body">
                        <p id="confirmMessage">¿Está seguro?</p>
                    </div>
                    <div class="confirm-modal-footer">
                        <button class="btn btn-secondary" id="confirmCancel">
                            <i class="fas fa-times"></i> Cancelar
                        </button>
                        <button class="btn btn-primary" id="confirmAccept">
                            <i class="fas fa-check"></i> Aceptar
                        </button>
                    </div>
                </div>
            `;
            document.body.appendChild(modal);
        }
    },

    bindFilterEvents() {
        // Dropdown filters
        document.getElementById('filterDateFrom')?.addEventListener('change', (e) => {
            DataStore.setDropdownFilter('dateFrom', e.target.value ? new Date(e.target.value) : null);
        });
        document.getElementById('filterDateTo')?.addEventListener('change', (e) => {
            DataStore.setDropdownFilter('dateTo', e.target.value ? new Date(e.target.value) : null);
        });
        document.getElementById('filterType')?.addEventListener('change', (e) => {
            DataStore.setDropdownFilter('type', e.target.value);
        });
        document.getElementById('filterQuadrant')?.addEventListener('change', (e) => {
            DataStore.setDropdownFilter('quadrant', e.target.value);
        });
        document.getElementById('filterOfficer')?.addEventListener('change', (e) => {
            DataStore.setDropdownFilter('officer', e.target.value);
        });
        document.getElementById('tableSearch')?.addEventListener('input', debounce((e) => {
            DataStore.setDropdownFilter('search', e.target.value);
        }, 300));
    },

    bindGlobalButtons() {
        // Clear filters
        document.getElementById('btnClearFilters')?.addEventListener('click', () => {
            DataStore.clearAllFilters();
            this.resetFilterInputs();
            showToast('Filtros limpiados', 'info');
        });

        document.getElementById('btnClearAllFilters')?.addEventListener('click', () => {
            DataStore.clearAllFilters();
            this.resetFilterInputs();
            showToast('Todos los filtros limpiados', 'info');
        });

        // New file
        document.getElementById('btnNewFile')?.addEventListener('click', () => {
            showConfirm('Cargar Nuevo Archivo', '¿Desea cargar un nuevo archivo? Los datos actuales serán reemplazados.', () => {
                FileParser.reset();
            });
        });

        // Export buttons
        document.getElementById('btnExportExcel')?.addEventListener('click', exportToExcel);
        document.getElementById('btnExportPDF')?.addEventListener('click', exportToPDF);

        // Menu toggle
        document.getElementById('menuToggle')?.addEventListener('click', () => {
            document.getElementById('sidebar')?.classList.toggle('open');
        });

        // Modal close
        document.getElementById('btnCloseModal')?.addEventListener('click', closeModal);
        document.getElementById('incidentModal')?.addEventListener('click', (e) => {
            if (e.target.id === 'incidentModal') closeModal();
        });

        // Keyboard
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                closeModal();
                hideConfirm();
            }
        });
    },

    resetFilterInputs() {
        const dates = DataStore.rawData.map(d => d.date).filter(d => d);
        if (dates.length > 0) {
            document.getElementById('filterDateFrom').value = formatDateForInput(new Date(Math.min(...dates)));
            document.getElementById('filterDateTo').value = formatDateForInput(new Date(Math.max(...dates)));
        }
        document.getElementById('filterType').value = '';
        document.getElementById('filterQuadrant').value = '';
        document.getElementById('filterOfficer').value = '';
        document.getElementById('tableSearch').value = '';
    },

    updateKPIs() {
        const agg = DataStore.getAggregations();
        animateValue('kpiTotalIncidents', agg.total);
        animateValue('kpiUndocumented', agg.undocumented);
        animateValue('kpiAccidents', agg.accidents);
        animateValue('kpiArrests', agg.arrests);
        animateValue('kpiOfficers', agg.officers);
        animateValue('kpiClosures', agg.closures);
    },

    updateActiveFiltersBadge() {
        const { count, active } = DataStore.getActiveFilters();
        const badge = document.getElementById('activeFiltersBadge');
        const countEl = document.getElementById('activeFiltersCount');
        const crossFiltersEl = document.getElementById('activeCrossFilters');

        if (count > 0) {
            badge.style.display = 'flex';
            countEl.textContent = count;

            // Show cross-filter pills
            if (crossFiltersEl) {
                crossFiltersEl.innerHTML = active
                    .filter(f => f.type === 'cross')
                    .map(f => `
                        <span class="filter-pill" onclick="removeCrossFilter('${f.key}')">
                            ${f.key}: ${f.value}
                            <i class="fas fa-times"></i>
                        </span>
                    `).join('');
            }
        } else {
            badge.style.display = 'none';
            if (crossFiltersEl) crossFiltersEl.innerHTML = '';
        }
    },

    populateFilters() {
        // Types
        const types = [...new Set(DataStore.rawData.map(d => d.type))].filter(t => t && t !== 'No especificado').sort();
        const typeSelect = document.getElementById('filterType');
        typeSelect.innerHTML = '<option value="">Todos los tipos</option>' +
            types.map(t => `<option value="${t}">${t}</option>`).join('');

        // Quadrants
        const quadrants = [...new Set(DataStore.rawData.map(d => d.quadrant))].filter(q => q && q !== 'No especificado').sort();
        const quadSelect = document.getElementById('filterQuadrant');
        quadSelect.innerHTML = '<option value="">Todos</option>' +
            quadrants.map(q => `<option value="${q}">${q}</option>`).join('');

        // Officers
        const officers = [...new Set(DataStore.rawData.map(d => d.officer))].filter(o => o && o !== 'No especificado').sort();
        const offSelect = document.getElementById('filterOfficer');
        offSelect.innerHTML = '<option value="">Todos</option>' +
            officers.map(o => `<option value="${o}">${truncateLabel(o, 40)}</option>`).join('');

        // Set default date range
        const dates = DataStore.rawData.map(d => d.date).filter(d => d);
        if (dates.length > 0) {
            document.getElementById('filterDateFrom').value = formatDateForInput(new Date(Math.min(...dates)));
            document.getElementById('filterDateTo').value = formatDateForInput(new Date(Math.max(...dates)));
        }
    }
};

// ============================================
// TABLE MANAGER
// ============================================
const TableManager = {
    currentPage: 1,
    pageSize: 25,
    sortColumn: 'date',
    sortDirection: 'desc',

    init() {
        // Sorting
        document.querySelectorAll('.data-table th[data-sort]').forEach(th => {
            th.addEventListener('click', () => this.handleSort(th.dataset.sort));
        });

        // Page size
        document.getElementById('pageSize')?.addEventListener('change', (e) => {
            this.pageSize = parseInt(e.target.value);
            this.currentPage = 1;
            this.render();
        });

        // Pagination buttons
        document.getElementById('btnPrevPage')?.addEventListener('click', () => {
            if (this.currentPage > 1) {
                this.currentPage--;
                this.render();
            }
        });

        document.getElementById('btnNextPage')?.addEventListener('click', () => {
            const totalPages = Math.ceil(DataStore.filteredData.length / this.pageSize);
            if (this.currentPage < totalPages) {
                this.currentPage++;
                this.render();
            }
        });
    },

    handleSort(column) {
        if (this.sortColumn === column) {
            this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
        } else {
            this.sortColumn = column;
            this.sortDirection = 'desc';
        }
        this.render();
    },

    render() {
        const data = [...DataStore.filteredData].sort((a, b) => {
            let valA, valB;
            switch (this.sortColumn) {
                case 'id': valA = parseInt(a.id) || 0; valB = parseInt(b.id) || 0; break;
                case 'date': valA = a.date?.getTime() || 0; valB = b.date?.getTime() || 0; break;
                case 'undoc': valA = a.undocumented || 0; valB = b.undocumented || 0; break;
                default: valA = (a[this.sortColumn] || '').toString().toLowerCase();
                    valB = (b[this.sortColumn] || '').toString().toLowerCase();
            }
            return this.sortDirection === 'asc' ? (valA > valB ? 1 : -1) : (valA < valB ? 1 : -1);
        });

        const total = data.length;
        const totalPages = Math.ceil(total / this.pageSize);
        const start = (this.currentPage - 1) * this.pageSize;
        const pageData = data.slice(start, start + this.pageSize);

        const tbody = document.getElementById('tableBody');
        if (!tbody) return;

        if (pageData.length === 0) {
            tbody.innerHTML = `<tr><td colspan="8" class="empty-state"><i class="fas fa-inbox"></i><p>No hay datos</p></td></tr>`;
        } else {
            tbody.innerHTML = pageData.map(row => `
                <tr>
                    <td>${row.id}</td>
                    <td>${formatDisplayDate(row.date)}</td>
                    <td><span class="type-badge ${getTypeBadgeClass(row.type)}">${row.type}</span></td>
                    <td>${row.quadrant}</td>
                    <td title="${escapeHtml(row.officer)}">${truncateLabel(row.officer, 25)}</td>
                    <td>${row.undocumented > 0 ? `<strong>${row.undocumented}</strong>` : '-'}</td>
                    <td class="narrative-cell" title="${escapeHtml(row.narrative)}">${truncateLabel(row.narrative, 40)}</td>
                    <td><button class="btn-view" onclick="viewIncident(${row.id})"><i class="fas fa-eye"></i></button></td>
                </tr>
            `).join('');
        }

        // Update pagination
        document.getElementById('paginationFrom').textContent = total > 0 ? start + 1 : 0;
        document.getElementById('paginationTo').textContent = Math.min(start + this.pageSize, total);
        document.getElementById('paginationTotal').textContent = total;
        document.getElementById('btnPrevPage').disabled = this.currentPage === 1;
        document.getElementById('btnNextPage').disabled = this.currentPage >= totalPages;

        // Page numbers
        const pagesEl = document.getElementById('paginationPages');
        let pagesHtml = '';
        const maxBtns = 5;
        let startPage = Math.max(1, this.currentPage - 2);
        let endPage = Math.min(totalPages, startPage + maxBtns - 1);
        for (let i = startPage; i <= endPage; i++) {
            pagesHtml += `<button class="${i === this.currentPage ? 'active' : ''}" onclick="TableManager.goToPage(${i})">${i}</button>`;
        }
        pagesEl.innerHTML = pagesHtml;

        // Update incidents page stats
        document.getElementById('incidentsTotal').textContent = DataStore.rawData.length;
        document.getElementById('incidentsFiltered').textContent = DataStore.filteredData.length;
    },

    goToPage(page) {
        this.currentPage = page;
        this.render();
    }
};

// ============================================
// FILE PARSER
// ============================================
const FileParser = {
    init() {
        const fileInput = document.getElementById('fileInput');
        const uploadZone = document.getElementById('uploadZone');

        fileInput?.addEventListener('change', (e) => this.handleFile(e.target.files[0]));

        uploadZone?.addEventListener('dragover', (e) => {
            e.preventDefault();
            uploadZone.classList.add('drag-over');
        });
        uploadZone?.addEventListener('dragleave', (e) => {
            e.preventDefault();
            uploadZone.classList.remove('drag-over');
        });
        uploadZone?.addEventListener('drop', (e) => {
            e.preventDefault();
            uploadZone.classList.remove('drag-over');
            this.handleFile(e.dataTransfer.files[0]);
        });
        uploadZone?.addEventListener('click', (e) => {
            if (e.target.tagName !== 'INPUT' && !e.target.closest('label')) {
                fileInput.click();
            }
        });
    },

    handleFile(file) {
        if (!file) return;
        showLoading(true);

        const name = file.name.toLowerCase();
        if (name.endsWith('.csv')) {
            this.parseCSV(file);
        } else if (name.endsWith('.xlsx') || name.endsWith('.xls')) {
            this.parseExcel(file);
        } else {
            showLoading(false);
            showToast('Formato no soportado. Use CSV o Excel', 'error');
        }
    },

    parseCSV(file) {
        Papa.parse(file, {
            header: true,
            skipEmptyLines: 'greedy',
            encoding: 'UTF-8',
            complete: (results) => {
                if (!results.data?.length) {
                    showLoading(false);
                    showToast('Archivo vacío', 'error');
                    return;
                }
                const normalized = this.normalizeData(results.data);
                DataStore.load(normalized);
            },
            error: (err) => {
                showLoading(false);
                showToast('Error leyendo CSV: ' + err.message, 'error');
            }
        });
    },

    parseExcel(file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = new Uint8Array(e.target.result);
                const wb = XLSX.read(data, { type: 'array', cellDates: true });
                const sheet = wb.Sheets[wb.SheetNames[0]];
                const json = XLSX.utils.sheet_to_json(sheet, { defval: '' });
                if (!json.length) {
                    showLoading(false);
                    showToast('Excel vacío', 'error');
                    return;
                }
                const normalized = this.normalizeData(json);
                DataStore.load(normalized);
            } catch (err) {
                showLoading(false);
                showToast('Error leyendo Excel: ' + err.message, 'error');
            }
        };
        reader.readAsArrayBuffer(file);
    },

    normalizeData(data) {
        return data.map((row, idx) => {
            const dateStr = row['Hora de inicio'] || row['Fecha'] || '';
            const date = parseDate(dateStr);
            let type = row['Tipo de Incidente'] || row['Tipo'] || 'No especificado';
            type = normalizeIncidentType(type);
            let quadrant = (row['Cuadrante donde sucedió el hecho'] || row['Cuadrante'] || '').toString().trim().toUpperCase();
            quadrant = normalizeQuadrant(quadrant); // Normalizar a B1, B2, B3, B4
            let officer = (row['Oficial a cargo'] || row['Oficial a cargo1'] || '').toString().trim();
            if (!officer || officer === '0') officer = 'No especificado';
            const undoc = parseInt(row['Cantidad de Indocumentados detenidos'] || 0) || 0;

            // Capturar evidencia visual
            const evidence = row['Evidencia Visual'] || '';

            return {
                id: row['Id'] || (idx + 1),
                date,
                dateStr,
                type,
                quadrant,
                officer,
                undocumented: undoc,
                narrative: (row['Narrativa del Incidente'] || '').toString().trim(),
                actions: (row['Acciones Tomadas'] || '').toString().trim(),
                transitIncident: row['Incidentes relacionados a tránsito'] || '',
                migrationIncident: row['Incidentes de migración'] || '',
                securityIncident: row['Incidentes de seguridad policial'] || '',
                personRole: row['Rol de la Persona'] || '',
                personName: row['Nombre Completo'] || '',
                evidence: evidence,
                rawData: row
            };
        });
    },

    reset() {
        ChartManager.destroyAll();
        DataStore.rawData = [];
        DataStore.filteredData = [];
        document.getElementById('uploadSection').style.display = 'flex';
        document.getElementById('dashboardPage').style.display = 'none';
        document.getElementById('dataStatus').innerHTML = '<i class="fas fa-database"></i><span>Sin datos</span>';
        document.getElementById('dataStatus').classList.remove('loaded');
        document.getElementById('btnExportExcel').disabled = true;
        document.getElementById('btnExportPDF').disabled = true;
        document.getElementById('fileInput').value = '';
        Navigation.currentPage = 'uploadSection';
        showToast('Dashboard reiniciado', 'info');
    }
};

// ============================================
// EVENT LISTENERS (Cross-Filter Updates)
// ============================================
EventBus.on('dataLoaded', () => {
    showLoading(false);
    UIManager.populateFilters();
    UIManager.updateKPIs();
    ChartManager.renderAll();
    TableManager.render();

    document.getElementById('uploadSection').style.display = 'none';
    const btnExcel = document.getElementById('btnExportExcel');
    if (btnExcel) btnExcel.disabled = false;
    const btnPDF = document.getElementById('btnExportPDF');
    if (btnPDF) btnPDF.disabled = false;
    const dataStatus = document.getElementById('dataStatus');
    if (dataStatus) {
        dataStatus.innerHTML = `<i class="fas fa-check-circle"></i><span>${DataStore.rawData.length} registros</span>`;
        dataStatus.classList.add('loaded');
    }

    // Hide sidebar upload button when data is loaded
    const btnSidebarUpload = document.getElementById('btnSidebarUpload');
    if (btnSidebarUpload) btnSidebarUpload.classList.add('hidden');

    Navigation.showDashboard();
    showToast(`${DataStore.rawData.length} registros cargados`, 'success');
});

EventBus.on('filtersChanged', () => {
    UIManager.updateKPIs();
    UIManager.updateActiveFiltersBadge();
    ChartManager.renderAll();
    TableManager.currentPage = 1;
    TableManager.render();

    if (Navigation.currentPage === 'analyticsPage') {
        ChartManager.renderAnalytics();
    }
});

EventBus.on('filtersCleared', () => {
    UIManager.updateKPIs();
    UIManager.updateActiveFiltersBadge();
    ChartManager.renderAll();
    TableManager.currentPage = 1;
    TableManager.render();
});

EventBus.on('pageChanged', (pageId) => {
    if (pageId === 'analyticsPage') {
        setTimeout(() => ChartManager.renderAnalytics(), 100);
    } else if (pageId === 'incidentsPage') {
        TableManager.render();
    }
});

// ============================================
// UTILITY FUNCTIONS
// ============================================
function showLoading(show) {
    document.getElementById('loadingOverlay')?.classList.toggle('active', show);
}

function showToast(message, type = 'info', duration = 4000) {
    const container = document.getElementById('toastContainer');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    const icons = { success: 'fa-check-circle', error: 'fa-exclamation-circle', warning: 'fa-exclamation-triangle', info: 'fa-info-circle' };
    toast.innerHTML = `<i class="fas ${icons[type]}"></i><span>${message}</span><button class="toast-close">&times;</button>`;
    container.appendChild(toast);
    setTimeout(() => toast.classList.add('show'), 10);
    toast.querySelector('.toast-close').addEventListener('click', () => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
    });
    setTimeout(() => { toast.classList.remove('show'); setTimeout(() => toast.remove(), 300); }, duration);
}

function showConfirm(title, message, onConfirm) {
    document.getElementById('confirmTitle').textContent = title;
    document.getElementById('confirmMessage').textContent = message;
    document.getElementById('confirmModal').classList.add('active');

    const accept = document.getElementById('confirmAccept');
    const cancel = document.getElementById('confirmCancel');
    const newAccept = accept.cloneNode(true);
    const newCancel = cancel.cloneNode(true);
    accept.parentNode.replaceChild(newAccept, accept);
    cancel.parentNode.replaceChild(newCancel, cancel);

    newAccept.addEventListener('click', () => { hideConfirm(); onConfirm?.(); });
    newCancel.addEventListener('click', hideConfirm);
}

function hideConfirm() {
    document.getElementById('confirmModal')?.classList.remove('active');
}

function closeModal() {
    document.getElementById('incidentModal')?.classList.remove('active');
}

function viewIncident(id) {
    const incident = DataStore.rawData.find(r => r.id == id);
    if (!incident) { showToast('No encontrado', 'error'); return; }

    // Generar HTML de evidencia (solo enlace, sin previsualización - SharePoint requiere autenticación)
    let evidenceHtml = '';
    if (incident.evidence && incident.evidence.trim()) {
        const evidenceUrl = incident.evidence.trim();
        evidenceHtml = `
            <div class="detail-evidence-section">
                <span class="detail-label"><i class="fas fa-camera"></i> Evidencia Visual</span>
                <div class="evidence-container">
                    <a href="${escapeHtml(evidenceUrl)}" target="_blank" class="btn btn-evidence">
                        <i class="fas fa-external-link-alt"></i> Ver Evidencia en SharePoint
                    </a>
                    <p class="evidence-note"><i class="fas fa-info-circle"></i> La evidencia se abrirá en una nueva pestaña (requiere acceso a SharePoint)</p>
                </div>
            </div>
        `;
    }

    document.getElementById('modalIncidentId').textContent = id;
    document.getElementById('modalBody').innerHTML = `
        <div class="detail-grid">
            <div class="detail-row"><span class="detail-label"><i class="fas fa-calendar"></i> Fecha</span><span class="detail-value">${formatDisplayDate(incident.date, true)}</span></div>
            <div class="detail-row"><span class="detail-label"><i class="fas fa-tag"></i> Tipo</span><span class="detail-value"><span class="type-badge ${getTypeBadgeClass(incident.type)}">${incident.type}</span></span></div>
            <div class="detail-row"><span class="detail-label"><i class="fas fa-map-marker-alt"></i> Cuadrante</span><span class="detail-value">${incident.quadrant}</span></div>
            <div class="detail-row"><span class="detail-label"><i class="fas fa-user-shield"></i> Oficial</span><span class="detail-value">${incident.officer}</span></div>
            <div class="detail-row"><span class="detail-label"><i class="fas fa-passport"></i> Indocumentados</span><span class="detail-value">${incident.undocumented || 'N/A'}</span></div>
            <div class="detail-row"><span class="detail-label"><i class="fas fa-gavel"></i> Acciones</span><span class="detail-value">${incident.actions || 'N/A'}</span></div>
        </div>
        <div class="detail-narrative"><span class="detail-label"><i class="fas fa-file-alt"></i> Narrativa</span><div class="narrative-full">${escapeHtml(incident.narrative) || 'Sin narrativa'}</div></div>
        ${evidenceHtml}
        <div class="detail-actions">
            <button class="btn btn-print" onclick="printIncidentReport(${id})">
                <i class="fas fa-print"></i> Imprimir Reporte
            </button>
        </div>
    `;
    document.getElementById('incidentModal').classList.add('active');
}

function removeCrossFilter(key) {
    DataStore.crossFilters[key] = null;
    DataStore.applyFilters();
    EventBus.emit('filtersChanged', DataStore.getActiveFilters());
}

function animateValue(elementId, endValue) {
    const el = document.getElementById(elementId);
    if (!el) return;
    const start = parseInt(el.textContent.replace(/,/g, '')) || 0;
    const duration = 400;
    const startTime = performance.now();
    function update(t) {
        const p = Math.min((t - startTime) / duration, 1);
        el.textContent = Math.round(start + (endValue - start) * (1 - Math.pow(1 - p, 3))).toLocaleString();
        if (p < 1) requestAnimationFrame(update);
    }
    requestAnimationFrame(update);
}

function debounce(fn, wait) {
    let t;
    return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), wait); };
}

function formatDateForInput(d) {
    if (!d) return '';
    return `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}-${d.getDate().toString().padStart(2, '0')}`;
}

function formatDisplayDate(d, time = false) {
    if (!d) return 'N/A';
    const opts = { day: '2-digit', month: '2-digit', year: 'numeric' };
    if (time) { opts.hour = '2-digit'; opts.minute = '2-digit'; }
    return d.toLocaleDateString('es-DO', opts);
}

function formatPeriodLabel(key, period) {
    if (period === 'daily') return key.split('-').slice(1).reverse().join('/');
    if (period === 'weekly') return key.replace('-', ' ');
    const [y, m] = key.split('-');
    const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
    return `${months[parseInt(m) - 1]} ${y}`;
}

function getWeekNumber(d) {
    const first = new Date(d.getFullYear(), 0, 1);
    return Math.ceil(((d - first) / 86400000 + first.getDay() + 1) / 7);
}

function parseDate(s) {
    if (!s) return null;
    s = s.toString().trim();
    let m = s.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})\s*(\d{1,2})?:?(\d{2})?/);
    if (m) return new Date(+m[3], +m[2] - 1, +m[1], +m[4] || 0, +m[5] || 0);
    m = s.match(/(\d{4})-(\d{2})-(\d{2})/);
    if (m) return new Date(+m[1], +m[2] - 1, +m[3]);
    const d = new Date(s);
    return isNaN(d) ? null : d;
}

function normalizeIncidentType(t) {
    if (!t) return 'Otros';
    t = t.toString().trim();
    const map = { migracion: 'Migración', migración: 'Migración', digesett: 'DIGESETT', inacif: 'INACIF', dicrim: 'DICRIM', dncd: 'DNCD', policia: 'Policía Nacional', seguridad: 'Seguridad' };
    for (const [k, v] of Object.entries(map)) if (t.toLowerCase().includes(k)) return v;
    return t || 'Otros';
}

// Normaliza cuadrantes a B1, B2, B3, B4 únicamente
function normalizeQuadrant(q) {
    if (!q || q === '0') return 'B1'; // Default a B1
    q = q.toString().trim().toUpperCase();

    // Si ya es un cuadrante válido, retornarlo
    if (['B1', 'B2', 'B3', 'B4'].includes(q)) return q;

    // Redistribuir valores no válidos
    const redistributeMap = {
        // Valores que van a B1 (área principal/entrada)
        'TODA LA CIUDAD': 'B1',
        'EN LAS PUERTAS PRINCIPALES DE CJB': 'B1',
        'PUERTAS PRINCIPALES': 'B1',
        'GARITA': 'B1',
        'ENTRADA': 'B1',

        // Valores que van a B3 (gaviota)
        'GAVIOTA #3': 'B3',
        'GAVIOTA': 'B3',
        'GAVIOTA 3': 'B3',

        // Valores combinados - asignar al primero
        'B1 Y B3': 'B1',
        'B1 Y B2': 'B1',
        'B2 Y B3': 'B2',
        'B3 Y B4': 'B3',
        'B1, B3': 'B1',

        // Otros valores no especificados
        'NO ESPECIFICADO': 'B1',
        'N/A': 'B1'
    };

    // Buscar en el mapa de redistribución
    if (redistributeMap[q]) return redistributeMap[q];

    // Si contiene algún cuadrante válido, extraerlo
    if (q.includes('B1')) return 'B1';
    if (q.includes('B2')) return 'B2';
    if (q.includes('B3')) return 'B3';
    if (q.includes('B4')) return 'B4';

    // Default a B1 si no se puede determinar
    return 'B1';
}

function normalizeAction(a) {
    if (!a) return null;
    a = a.toLowerCase();
    if (a.includes('arresto') || a.includes('detención')) return 'Arresto/Detención';
    if (a.includes('advertencia')) return 'Advertencia';
    if (a.includes('asistencia')) return 'Asistencia';
    if (a.includes('clausura')) return 'Clausura';
    if (a.includes('migración')) return 'Entrega Migración';
    if (a.includes('policía')) return 'Entrega PN';
    if (a.includes('digesett')) return 'Ref. DIGESETT';
    if (a.includes('multa')) return 'Multa';
    return null;
}

function truncateLabel(t, max) { return t?.length > max ? t.substring(0, max) + '...' : (t || ''); }
function escapeHtml(t) { const d = document.createElement('div'); d.textContent = t || ''; return d.innerHTML; }
function getTypeBadgeClass(t) {
    if (!t) return 'other';
    t = t.toLowerCase();
    if (t.includes('migra')) return 'migration'; if (t.includes('digesett')) return 'transit';
    if (t.includes('seguridad') || t.includes('policia')) return 'security'; return 'other';
}

// Export functions
function exportToExcel() {
    showToast('Generando Excel...', 'info', 2000);
    const data = DataStore.filteredData.map(r => ({
        ID: r.id, Fecha: formatDisplayDate(r.date), Tipo: r.type, Cuadrante: r.quadrant,
        Oficial: r.officer, Indocumentados: r.undocumented, Narrativa: r.narrative, Acciones: r.actions
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Incidentes');
    XLSX.writeFile(wb, `Incidentes_CJB_${new Date().toISOString().slice(0, 10)}.xlsx`);
    showToast('Excel descargado', 'success');
}

function exportToPDF() {
    const element = document.getElementById('dashboardPage');
    if (!element) {
        showToast('Dashboard no encontrado', 'error');
        return;
    }

    showToast('Preparando captura del Dashboard...', 'info');
    showLoading(true);

    // Scroll to top
    window.scrollTo(0, 0);

    // Use a simpler approach - target only the visible content
    const opt = {
        margin: 5,
        filename: `Dashboard_CJB_${new Date().toISOString().slice(0, 10)}.pdf`,
        image: { type: 'jpeg', quality: 0.95 },
        html2canvas: {
            scale: 1.5,
            useCORS: true,
            backgroundColor: '#ffffff',
            scrollX: 0,
            scrollY: 0
        },
        jsPDF: {
            unit: 'mm',
            format: 'a4',
            orientation: 'landscape'
        },
        pagebreak: { mode: 'avoid-all' }
    };

    // Give charts time to fully render
    setTimeout(() => {
        html2pdf()
            .set(opt)
            .from(element)
            .save()
            .then(() => {
                showLoading(false);
                showToast('Dashboard descargado correctamente', 'success');
            })
            .catch(err => {
                console.error('PDF Error:', err);
                showLoading(false);
                showToast('Error generando PDF. Intente de nuevo.', 'error');
            });
    }, 2000);
}

function generateInsights() {
    const agg = DataStore.getAggregations();
    const typeDist = DataStore.groupBy('type').sort((a, b) => b[1] - a[1]);
    const quadDist = DataStore.groupBy('quadrant').filter(([q]) => q !== 'No especificado').sort((a, b) => b[1] - a[1]);
    const officerDist = DataStore.groupBy('officer').sort((a, b) => b[1] - a[1]);

    // Calculate percentages
    const topTypePercent = agg.total > 0 ? Math.round((typeDist[0]?.[1] || 0) / agg.total * 100) : 0;
    const topQuadPercent = agg.total > 0 ? Math.round((quadDist[0]?.[1] || 0) / agg.total * 100) : 0;

    // Hallazgos detallados
    const findings = [];

    if (typeDist.length > 0) {
        findings.push(`<strong>Tipo de Incidente más frecuente:</strong> ${typeDist[0][0]} con ${typeDist[0][1]} casos (${topTypePercent}% del total). Esta categoría representa la mayor concentración de eventos reportados durante el período analizado.`);
    }

    if (quadDist.length > 0) {
        findings.push(`<strong>Zona de mayor actividad:</strong> El cuadrante ${quadDist[0][0]} concentra ${quadDist[0][1]} incidentes (${topQuadPercent}% del total), indicando una necesidad de reforzamiento de patrullaje en esta área.`);
    }

    if (agg.undocumented > 0) {
        const undocPercent = Math.round(agg.undocumented / agg.total * 100);
        findings.push(`<strong>Actividad Migratoria:</strong> Se registraron ${agg.undocumented} indocumentados detenidos (${undocPercent}% de los incidentes), evidenciando el trabajo coordinado con las autoridades migratorias.`);
    }

    if (agg.accidents > 0) {
        findings.push(`<strong>Seguridad Vial:</strong> ${agg.accidents} accidentes de tránsito registrados. Se recomienda identificar los puntos críticos para implementar medidas preventivas.`);
    }

    if (officerDist.length > 0) {
        findings.push(`<strong>Liderazgo Operativo:</strong> El oficial con mayor actividad es ${officerDist[0][0]} con ${officerDist[0][1]} intervenciones documentadas.`);
    }

    if (typeDist.length > 1) {
        const secondType = typeDist[1];
        findings.push(`<strong>Segunda categoría más frecuente:</strong> ${secondType[0]} con ${secondType[1]} casos, representando otra área de atención prioritaria.`);
    }

    // Análisis por cuadrante
    const quadrantAnalysis = quadDist.slice(0, 4).map(([q, count]) => {
        const percent = Math.round(count / agg.total * 100);
        return `<strong>${q}:</strong> ${count} incidentes (${percent}%)`;
    });

    // Conclusiones y recomendaciones detalladas
    const conclusions = [];

    conclusions.push('<strong>Estado Operativo General:</strong> La Dirección de Seguridad mantiene un nivel de operatividad activo y constante en todos los cuadrantes de Ciudad Juan Bosch, garantizando la presencia institucional y la respuesta oportuna ante eventos de seguridad.');

    if (agg.closures > 0) {
        conclusions.push(`<strong>Control de Establecimientos:</strong> Se han ejecutado ${agg.closures} clausuras de establecimientos irregulares, demostrando efectividad en el cumplimiento normativo y la seguridad comunitaria.`);
    }

    if (agg.arrests > 0) {
        conclusions.push(`<strong>Acciones de Ley:</strong> Se realizaron ${agg.arrests} arrestos/detenciones durante el período, reflejando la capacidad de respuesta ante situaciones que requieren intervención directa.`);
    }

    conclusions.push('<strong>Recomendación Estratégica:</strong> Mantener y reforzar el patrullaje preventivo en las zonas de mayor incidencia detectadas, con énfasis especial en los horarios de mayor actividad identificados.');

    conclusions.push('<strong>Coordinación Interinstitucional:</strong> Continuar fortaleciendo los lazos de cooperación con Migración, DIGESETT, y Policía Nacional para una respuesta integral a las necesidades de seguridad ciudadana.');

    conclusions.push('<strong>Capacitación Continua:</strong> Se recomienda mantener programas de actualización para el personal de seguridad, enfocados en las tipologías de incidentes más frecuentes.');

    return { findings, conclusions, quadrantAnalysis, typeDist, officerDist };
}

function generateExecutiveSummary() {
    const agg = DataStore.getAggregations();
    const insights = generateInsights();
    const modal = document.getElementById('summaryModal');

    const today = new Date().toLocaleDateString('es-DO', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });
    const dateFrom = document.getElementById('filterDateFrom')?.value;
    const dateTo = document.getElementById('filterDateTo')?.value;
    const period = dateFrom && dateTo ? `Del ${dateFrom} al ${dateTo}` : 'Período completo de datos disponibles';

    // Calculate additional metrics
    const avgPerDay = agg.total > 0 ? (agg.total / 30).toFixed(1) : 0;
    const topOfficers = insights.officerDist?.slice(0, 3) || [];

    document.getElementById('summaryModalBody').innerHTML = `
        <div class="summary-content printable-summary">
            <!-- Header Oficial con AMBOS Logos -->
            <div class="summary-header" style="display: flex; align-items: center; justify-content: space-between; padding: 20px; background: linear-gradient(135deg, #1E3A5F 0%, #2d5a8a 100%); border-radius: 12px; color: white; margin-bottom: 25px;">
                <img src="logo-vbc.png" alt="Logo Fideicomiso VBC RD" style="width: 90px; height: auto; background: white; padding: 8px; border-radius: 8px;">
                <div class="summary-title-text" style="text-align: center; flex: 1; padding: 0 15px;">
                    <h2 style="margin: 0; font-size: 1.3rem; color: white;">FIDEICOMISO PÚBLICO PARA LA CONSTRUCCIÓN DE VIVIENDAS DE BAJO COSTO</h2>
                    <h3 style="margin: 5px 0; font-size: 1.1rem; color: #ecf0f1;">DIRECCIÓN DE SEGURIDAD - Ciudad Juan Bosch</h3>
                    <p style="margin: 5px 0; font-size: 0.9rem; color: #bdc3c7;">Resumen Ejecutivo de Incidentes y Operatividad</p>
                </div>
                <img src="logo-security.png" alt="Logo Seguridad CJB" style="width: 70px; height: auto; background: white; padding: 8px; border-radius: 8px;">
            </div>
            
            <!-- Meta información -->
            <div class="summary-meta-grid" style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 15px; margin-bottom: 20px; padding: 15px; background: #f8f9fa; border-radius: 8px;">
                <div><strong>📅 Fecha de Emisión:</strong> ${today}</div>
                <div><strong>📊 Periodo Analizado:</strong> ${period}</div>
            </div>

            <!-- Introducción -->
            <div class="summary-section" style="margin-bottom: 25px; padding: 20px; background: white; border-radius: 8px; border-left: 4px solid #1E3A5F;">
                <h4 style="color: #1E3A5F; margin-bottom: 15px;"><i class="fas fa-info-circle"></i> Introducción</h4>
                <p style="text-align: justify; line-height: 1.8; color: #333;">
                    El presente documento constituye el <strong>Resumen Ejecutivo de Gestión de Seguridad</strong> correspondiente al período analizado. 
                    La Dirección de Seguridad de Ciudad Juan Bosch, bajo la supervisión del Fideicomiso Público para la Construcción de Viviendas de Bajo Costo 
                    de la República Dominicana (FIDEICOMISO VBC RD), presenta los indicadores clave de desempeño, hallazgos principales y recomendaciones 
                    estratégicas derivadas del análisis de incidentes registrados durante este período.
                </p>
                <p style="text-align: justify; line-height: 1.8; color: #333; margin-top: 10px;">
                    Este informe tiene como objetivo proporcionar una visión integral del estado de la seguridad ciudadana en los diferentes cuadrantes 
                    que conforman Ciudad Juan Bosch, facilitando la toma de decisiones informadas para la mejora continua de los servicios de seguridad.
                </p>
            </div>

            <hr style="border: none; border-top: 2px solid #1E3A5F; margin: 25px 0;">

            <!-- Métricas Principales -->
            <div class="summary-section" style="margin-bottom: 25px;">
                <h4 style="color: #1E3A5F; margin-bottom: 15px;"><i class="fas fa-chart-pie"></i> Indicadores Clave de Desempeño (KPIs)</h4>
                <div class="metrics-grid-summary" style="display: grid; grid-template-columns: repeat(5, 1fr); gap: 15px;">
                    <div class="metric-box" style="background: linear-gradient(135deg, #1E3A5F, #2d5a8a); padding: 20px; border-radius: 10px; text-align: center; color: white;">
                        <span class="m-val" style="font-size: 2rem; font-weight: 700; display: block;">${agg.total}</span>
                        <span class="m-label" style="font-size: 0.85rem; opacity: 0.9;">Total Incidentes</span>
                    </div>
                    <div class="metric-box" style="background: linear-gradient(135deg, #E74C3C, #c0392b); padding: 20px; border-radius: 10px; text-align: center; color: white;">
                        <span class="m-val" style="font-size: 2rem; font-weight: 700; display: block;">${agg.undocumented}</span>
                        <span class="m-label" style="font-size: 0.85rem; opacity: 0.9;">Indocumentados</span>
                    </div>
                    <div class="metric-box" style="background: linear-gradient(135deg, #F39C12, #d68910); padding: 20px; border-radius: 10px; text-align: center; color: white;">
                        <span class="m-val" style="font-size: 2rem; font-weight: 700; display: block;">${agg.accidents}</span>
                        <span class="m-label" style="font-size: 0.85rem; opacity: 0.9;">Accidentes Tránsito</span>
                    </div>
                    <div class="metric-box" style="background: linear-gradient(135deg, #27AE60, #1e8449); padding: 20px; border-radius: 10px; text-align: center; color: white;">
                        <span class="m-val" style="font-size: 2rem; font-weight: 700; display: block;">${agg.arrests}</span>
                        <span class="m-label" style="font-size: 0.85rem; opacity: 0.9;">Arrestos</span>
                    </div>
                    <div class="metric-box" style="background: linear-gradient(135deg, #9B59B6, #7d3c98); padding: 20px; border-radius: 10px; text-align: center; color: white;">
                        <span class="m-val" style="font-size: 2rem; font-weight: 700; display: block;">${agg.officers}</span>
                        <span class="m-label" style="font-size: 0.85rem; opacity: 0.9;">Oficiales Activos</span>
                    </div>
                </div>
                <p style="text-align: center; margin-top: 15px; color: #666; font-size: 0.9rem;">
                    <i class="fas fa-calculator"></i> Promedio estimado: <strong>${avgPerDay}</strong> incidentes por día
                </p>
            </div>

            <!-- Distribución por Cuadrante -->
            <div class="summary-section" style="margin-bottom: 25px; padding: 20px; background: #fff; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.05);">
                <h4 style="color: #1E3A5F; margin-bottom: 15px;"><i class="fas fa-map-marker-alt"></i> Distribución por Cuadrante</h4>
                <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px;">
                    ${insights.quadrantAnalysis?.map(qa => `<div style="padding: 15px; background: #f8f9fa; border-radius: 8px; text-align: center;">${qa}</div>`).join('') || '<div>Sin datos de cuadrante disponibles</div>'}
                </div>
            </div>

            <!-- Oficiales más activos -->
            ${topOfficers.length > 0 ? `
            <div class="summary-section" style="margin-bottom: 25px; padding: 20px; background: #fff; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.05);">
                <h4 style="color: #1E3A5F; margin-bottom: 15px;"><i class="fas fa-user-shield"></i> Oficiales con Mayor Actividad</h4>
                <table style="width: 100%; border-collapse: collapse;">
                    <thead>
                        <tr style="background: #1E3A5F; color: white;">
                            <th style="padding: 12px; text-align: left; border-radius: 8px 0 0 0;">#</th>
                            <th style="padding: 12px; text-align: left;">Oficial</th>
                            <th style="padding: 12px; text-align: center; border-radius: 0 8px 0 0;">Intervenciones</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${topOfficers.map((o, i) => `
                            <tr style="background: ${i % 2 === 0 ? '#f8f9fa' : 'white'};">
                                <td style="padding: 12px; font-weight: bold; color: #1E3A5F;">${i + 1}</td>
                                <td style="padding: 12px;">${o[0]}</td>
                                <td style="padding: 12px; text-align: center; font-weight: bold;">${o[1]}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>` : ''}

            <!-- Hallazgos y Conclusiones -->
            <div class="summary-cols" style="display: grid; grid-template-columns: 1fr 1fr; gap: 25px; margin-bottom: 25px;">
                <div class="summary-col" style="background: #fff; padding: 20px; border-radius: 8px; border-top: 4px solid #3498db;">
                    <h4 style="color: #1E3A5F; margin-bottom: 15px;"><i class="fas fa-search"></i> Hallazgos Principales</h4>
                    <ul class="insights-list" style="list-style: none; padding: 0; margin: 0;">
                        ${insights.findings.map(f => `<li style="padding: 12px 0; border-bottom: 1px solid #eee; line-height: 1.6;">${f}</li>`).join('')}
                    </ul>
                </div>
                <div class="summary-col" style="background: #fff; padding: 20px; border-radius: 8px; border-top: 4px solid #27ae60;">
                    <h4 style="color: #1E3A5F; margin-bottom: 15px;"><i class="fas fa-clipboard-check"></i> Conclusiones y Recomendaciones</h4>
                    <ul class="insights-list" style="list-style: none; padding: 0; margin: 0;">
                        ${insights.conclusions.map(c => `<li style="padding: 12px 0; border-bottom: 1px solid #eee; line-height: 1.6;">${c}</li>`).join('')}
                    </ul>
                </div>
            </div>
            
            <!-- Footer -->
            <div class="summary-footer" style="text-align: center; padding: 25px; background: linear-gradient(135deg, #f8f9fa, #e9ecef); border-radius: 8px; margin-top: 30px;">
                <p style="color: #666; margin-bottom: 5px;"><i class="fas fa-shield-alt"></i> <strong>Dirección de Seguridad - Ciudad Juan Bosch</strong></p>
                <p style="color: #888; font-size: 0.85rem; margin-bottom: 15px;">Documento generado automáticamente por el Sistema de Gestión de Seguridad CJB.</p>
                <p style="color: #999; font-size: 0.8rem;">Fideicomiso Público para la Construcción de Viviendas de Bajo Costo de la República Dominicana (FIDEICOMISO VBC RD)</p>
                <div class="summary-actions no-print" style="margin-top: 20px;">
                    <button class="btn btn-primary" onclick="downloadSummaryPDF()" style="margin: 0 5px;"><i class="fas fa-download"></i> Descargar PDF</button>
                    <button class="btn btn-secondary" onclick="printSummary()" style="margin: 0 5px;"><i class="fas fa-print"></i> Imprimir</button>
                </div>
            </div>
        </div>
    `;
    modal.classList.add('active');
}

function closeSummaryModal() { document.getElementById('summaryModal')?.classList.remove('active'); }

function printSummary() {
    // Usar iframe oculto para impresión limpia
    let printFrame = document.getElementById('printFrameSummary');
    if (!printFrame) {
        printFrame = document.createElement('iframe');
        printFrame.id = 'printFrameSummary';
        printFrame.style.position = 'fixed';
        printFrame.style.right = '0';
        printFrame.style.bottom = '0';
        printFrame.style.width = '0';
        printFrame.style.height = '0';
        printFrame.style.border = '0';
        document.body.appendChild(printFrame);
    }

    // Obtener contenido HTML del modal generado
    const content = document.getElementById('summaryModalBody').innerHTML;

    const doc = printFrame.contentWindow.document;
    doc.open();
    doc.write(`
        <!DOCTYPE html>
        <html lang="es">
        <head>
            <meta charset="UTF-8">
            <title>Resumen Ejecutivo CJB</title>
            <style>
                body { font-family: 'Arial', sans-serif; color: #333; line-height: 1.5; padding: 20px; }
                .summary-header { display: flex; align-items: center; justify-content: center; gap: 20px; margin-bottom: 20px; border-bottom: 2px solid #1E3A5F; padding-bottom: 15px; }
                .summary-logo { width: 80px; height: auto; }
                .summary-title-text { text-align: center; }
                .summary-title-text h2 { color: #1E3A5F; margin: 0; font-size: 1.5rem; }
                .summary-title-text h3 { color: #2ECC71; margin: 5px 0; font-size: 1.1rem; font-weight: normal; }
                .summary-title-text p { color: #666; margin: 0; font-size: 0.9rem; }
                .summary-meta-grid { display: flex; justify-content: space-between; margin-bottom: 20px; font-size: 0.9rem; background: #f8f9fa; padding: 10px; border-radius: 4px; }
                .summary-section { margin-bottom: 25px; }
                .summary-section h4 { background: #1E3A5F; color: white; padding: 8px 15px; margin-bottom: 15px; font-size: 1rem; -webkit-print-color-adjust: exact; }
                .metrics-grid-summary { display: grid; grid-template-columns: repeat(5, 1fr); gap: 10px; }
                .metric-box { border: 1px solid #ddd; padding: 10px; text-align: center; border-radius: 4px; }
                .m-val { display: block; font-size: 1.2rem; font-weight: bold; color: #1E3A5F; }
                .m-label { font-size: 0.75rem; color: #666; }
                .summary-cols { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
                .summary-col h4 { border-bottom: 2px solid #2ECC71; color: #1E3A5F; padding-bottom: 5px; margin-bottom: 10px; }
                .insights-list { padding-left: 20px; }
                .insights-list li { margin-bottom: 8px; font-size: 0.95rem; }
                .summary-footer { margin-top: 40px; text-align: center; font-size: 0.8rem; color: #999; border-top: 1px solid #eee; padding-top: 10px; }
                .no-print { display: none !important; }
                @media print {
                    @page { margin: 1cm; size: A4; }
                    body { -webkit-print-color-adjust: exact; }
                    .no-print { display: none !important; }
                }
            </style>
        </head>
        <body>
            ${content}
        </body>
        </html>
    `);
    doc.close();

    setTimeout(() => {
        printFrame.contentWindow.focus();
        printFrame.contentWindow.print();
    }, 500);
}

// Función para imprimir reporte individual de incidente con formato oficial CJB
function printIncidentReport(id) {
    const incident = DataStore.rawData.find(r => r.id == id);
    if (!incident) { showToast('Incidente no encontrado', 'error'); return; }

    const reportDate = formatDisplayDate(incident.date, true);
    const today = new Date().toLocaleDateString('es-DO', { day: '2-digit', month: 'long', year: 'numeric' });

    // Crear iframe oculto para impresión
    let printFrame = document.getElementById('printFrame');
    if (!printFrame) {
        printFrame = document.createElement('iframe');
        printFrame.id = 'printFrame';
        printFrame.style.position = 'fixed';
        printFrame.style.right = '0';
        printFrame.style.bottom = '0';
        printFrame.style.width = '0';
        printFrame.style.height = '0';
        printFrame.style.border = '0';
        document.body.appendChild(printFrame);
    }

    const doc = printFrame.contentWindow.document;
    doc.open();
    doc.write(`
        <!DOCTYPE html>
        <html lang="es">
        <head>
            <meta charset="UTF-8">
            <title>Informe de Incidente #${incident.id}</title>
            <style>
                * { margin: 0; padding: 0; box-sizing: border-box; }
                body { 
                    font-family: 'Arial', sans-serif; 
                    padding: 40px; 
                    color: #333;
                    line-height: 1.6;
                    background: white;
                }
                .header-container {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 20px;
                    margin-bottom: 30px;
                    border-bottom: 3px solid #1E3A5F;
                    padding-bottom: 20px;
                }
                .logo {
                    width: 100px;
                    height: auto;
                }
                .header-text {
                    text-align: center; 
                }
                .header-text h1 { 
                    color: #1E3A5F; 
                    font-size: 1.8rem;
                }
                .header-text h2 { 
                    color: #2ECC71;
                    font-size: 1.2rem;
                    font-weight: normal;
                }
                .header-text .subtitle {
                    color: #666;
                    font-size: 0.9rem;
                    margin-top: 10px;
                }
                .report-title {
                    background: #1E3A5F;
                    color: white;
                    padding: 10px 20px;
                    text-align: center;
                    margin: 20px 0;
                    font-size: 1.1rem;
                    -webkit-print-color-adjust: exact;
                }
                .info-grid {
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: 15px;
                    margin: 20px 0;
                }
                .info-item {
                    border: 1px solid #ddd;
                    padding: 12px;
                    border-radius: 5px;
                    page-break-inside: avoid;
                }
                .info-label {
                    font-size: 0.75rem;
                    color: #666;
                    text-transform: uppercase;
                    font-weight: bold;
                    display: block;
                    margin-bottom: 5px;
                }
                .info-value {
                    font-size: 1rem;
                    color: #1E3A5F;
                    font-weight: 600;
                }
                .section {
                    margin: 25px 0;
                    page-break-inside: avoid;
                }
                .section-title {
                    background: #f5f5f5;
                    padding: 8px 15px;
                    border-left: 4px solid #2ECC71;
                    font-weight: bold;
                    color: #1E3A5F;
                    margin-bottom: 15px;
                    -webkit-print-color-adjust: exact;
                }
                .narrative-box {
                    border: 1px solid #ddd;
                    padding: 15px;
                    border-radius: 5px;
                    background: #fafafa;
                    min-height: 100px;
                    white-space: pre-wrap;
                }
                .footer {
                    margin-top: 50px;
                    padding-top: 20px;
                    border-top: 2px solid #1E3A5F;
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: 50px;
                    page-break-inside: avoid;
                }
                .signature-box {
                    text-align: center;
                    padding-top: 40px;
                    border-top: 1px solid #333;
                }
                .signature-label {
                    font-size: 0.8rem;
                    color: #666;
                }
                .print-date {
                    text-align: right;
                    font-size: 0.8rem;
                    color: #999;
                    margin-top: 30px;
                }
                @media print {
                    @page { margin: 1cm; size: A4; }
                    body { -webkit-print-color-adjust: exact; }
                }
            </style>
        </head>
        <body>
            <div class="header-container">
                <img src="logo-security.png" alt="Logo CJB" class="logo">
                <div class="header-text">
                    <h1>DIRECCIÓN DE SEGURIDAD</h1>
                    <h2>Ciudad Juan Bosch</h2>
                    <p class="subtitle">Santo Domingo Este, República Dominicana</p>
                </div>
            </div>
            
            <div class="report-title">
                INFORME DE INCIDENTE #${incident.id}
            </div>
            
            <div class="info-grid">
                <div class="info-item">
                    <span class="info-label">Fecha y Hora</span>
                    <span class="info-value">${reportDate}</span>
                </div>
                <div class="info-item">
                    <span class="info-label">Tipo de Incidente</span>
                    <span class="info-value">${incident.type}</span>
                </div>
                <div class="info-item">
                    <span class="info-label">Cuadrante</span>
                    <span class="info-value">${incident.quadrant}</span>
                </div>
                <div class="info-item">
                    <span class="info-label">Oficial a Cargo</span>
                    <span class="info-value">${incident.officer}</span>
                </div>
                <div class="info-item">
                    <span class="info-label">Indocumentados Detenidos</span>
                    <span class="info-value">${incident.undocumented || '0'}</span>
                </div>
                <div class="info-item">
                    <span class="info-label">Acciones Tomadas</span>
                    <span class="info-value">${incident.actions || 'N/A'}</span>
                </div>
            </div>
            
            <div class="section">
                <div class="section-title">NARRATIVA DEL INCIDENTE</div>
                <div class="narrative-box">${escapeHtml(incident.narrative) || 'Sin narrativa registrada.'}</div>
            </div>
            
            
            <div class="footer">
                <div class="signature-box">
                    <span class="signature-label">Firma del Oficial</span>
                </div>
                <div class="signature-box">
                    <span class="signature-label">Firma del Supervisor</span>
                </div>
            </div>
            
            <p class="print-date">Generado el ${today}</p>
        </body>
        </html>
    `);
    doc.close();

    // Esperar a que cargue y llamar a print
    setTimeout(() => {
        printFrame.contentWindow.focus();
        printFrame.contentWindow.print();
    }, 500);
}

// ============================================
// AUTO-LOAD DATA (GitHub Pages > Local API > SharePoint)
// ============================================

// GitHub raw URL for data.json
const GITHUB_DATA_URL = 'https://raw.githubusercontent.com/jesusx26x/dashboard-seguridad-cjb/main/data.json';

async function loadFromSharePoint() {
    console.log('[AutoLoad] Starting auto-load sequence...');

    // Detect if running on GitHub Pages
    const isGitHubPages = window.location.hostname.includes('github.io');

    // STEP 1: If on GitHub Pages, load from data.json
    if (isGitHubPages) {
        console.log('[AutoLoad] Detected GitHub Pages environment');
        const ghLoaded = await tryLoadFromGitHub();
        if (ghLoaded) {
            console.log('[AutoLoad] Data loaded from GitHub data.json');
            return true;
        }
    }

    // STEP 2: Try local Node.js API (for localhost development)
    const apiLoaded = await tryLoadFromLocalAPI();
    if (apiLoaded) {
        console.log('[AutoLoad] Data loaded from local API');
        return true;
    }

    // STEP 3: Fallback to SharePoint if configured
    if (typeof CONFIG !== 'undefined' && CONFIG.AUTO_LOAD_FROM_CLOUD && CONFIG.SHAREPOINT_URL) {
        const spLoaded = await tryLoadFromSharePoint();
        if (spLoaded) {
            console.log('[AutoLoad] Data loaded from SharePoint');
            return true;
        }
    }

    console.log('[AutoLoad] No auto-load source available. User must upload manually.');
    return false;
}

/**
 * Try to load data from GitHub raw JSON file
 */
async function tryLoadFromGitHub() {
    try {
        console.log('[GitHub] Loading data from:', GITHUB_DATA_URL);
        showToast('Cargando datos desde GitHub...', 'info');
        showLoading(true);

        const response = await fetch(GITHUB_DATA_URL + '?t=' + Date.now()); // Cache bust

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        const result = await response.json();

        if (!result.data || !result.data.length) {
            throw new Error('No data in JSON file');
        }

        console.log(`[GitHub] Received ${result.count} records, last update: ${result.lastUpdate}`);

        // Transform and load data
        const transformedData = transformAPIData(result.data);
        DataStore.load(transformedData);

        // Show last update time
        const updateDate = new Date(result.lastUpdate);
        const formattedDate = updateDate.toLocaleDateString('es-DO', {
            day: '2-digit', month: '2-digit', year: 'numeric',
            hour: '2-digit', minute: '2-digit'
        });
        showToast(`✅ ${result.count} registros (Actualizado: ${formattedDate})`, 'success');

        return true;

    } catch (error) {
        console.error('[GitHub] Error loading data:', error);
        showLoading(false);
        return false;
    }
}

/**
 * Try to load data from local Node.js API
 */
async function tryLoadFromLocalAPI() {
    try {
        console.log('[API] Attempting to connect to local server...');

        // Use short timeout to fail fast if server isn't running
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3000);

        const response = await fetch('/api/incidentes', {
            signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        const result = await response.json();

        if (!result.success || !result.data || !result.data.length) {
            throw new Error('No data received');
        }

        console.log(`[API] Received ${result.count} records`);

        // Transform and load data
        const transformedData = transformAPIData(result.data);
        DataStore.load(transformedData);

        showToast(`✅ ${result.count} registros cargados desde Excel local`, 'success');
        return true;

    } catch (error) {
        // Silent fail - server might not be running
        console.log('[API] Local server not available:', error.message);
        return false;
    }
}

/**
 * Try to load data from SharePoint (fallback)
 */
async function tryLoadFromSharePoint() {
    try {
        showToast('Conectando con SharePoint...', 'info');
        showLoading(true);

        const response = await fetch(CONFIG.SHAREPOINT_URL, {
            method: 'GET',
            mode: 'cors',
            credentials: 'include'
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const arrayBuffer = await response.arrayBuffer();
        const data = new Uint8Array(arrayBuffer);
        const workbook = XLSX.read(data, { type: 'array', cellDates: true });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const json = XLSX.utils.sheet_to_json(sheet, { defval: '' });

        if (!json.length) {
            throw new Error('El archivo Excel está vacío');
        }

        const normalized = FileParser.normalizeData(json);
        DataStore.load(normalized);
        showToast(`✅ ${normalized.length} registros cargados desde SharePoint`, 'success');
        return true;

    } catch (error) {
        console.error('[SharePoint] Error:', error);
        showLoading(false);

        if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
            console.log('[SharePoint] CORS blocked the request');
        }
        return false;
    }
}

// ============================================
// INITIALIZATION
// ============================================
document.addEventListener('DOMContentLoaded', async () => {
    UIManager.init();
    ChartManager.init();
    Navigation.init();
    TableManager.init();
    FileParser.init();
    console.log('Dashboard CJB v3.0 - Power BI Edition cargado');

    // Try auto-load from SharePoint if configured
    const loaded = await loadFromSharePoint();

    if (!loaded) {
        // Show manual upload section
        document.getElementById('uploadSection').style.display = 'flex';
    }
});

// ============================================
// HISTORICAL DATA LOGIC
// ============================================
let historyChartInstance = null;
let historyPieChartInstance = null;
let historyLineChartInstance = null;

// Estructura de datos históricos permanentes (12 períodos completos)
const defaultHistoryData = {
    // Julio 2025
    'pdf-jul-14-21': {
        label: '14 jul 2025 - 21 jul 2025',
        fechaInicio: '2025-07-14',
        fechaFin: '2025-07-21',
        haitianos: 23, multas: 178, motos: 0, llamadas: 22, accidentes: 6, asistencias: 5
    },
    'pdf-jul-21-27': {
        label: '21 jul 2025 - 27 jul 2025',
        fechaInicio: '2025-07-21',
        fechaFin: '2025-07-27',
        haitianos: 27, multas: 206, motos: 0, llamadas: 10, accidentes: 2, asistencias: 9
    },
    'pdf-jul-28-ago-03': {
        label: '28 jul 2025 - 03 ago 2025',
        fechaInicio: '2025-07-28',
        fechaFin: '2025-08-03',
        haitianos: 17, multas: 166, motos: 0, llamadas: 16, accidentes: 9, asistencias: 10
    },
    // Agosto 2025
    'pdf-ago-25-31': {
        label: '25 ago 2025 - 31 ago 2025',
        fechaInicio: '2025-08-25',
        fechaFin: '2025-08-31',
        haitianos: 12, multas: 144, motos: 0, llamadas: 12, accidentes: 1, asistencias: 5
    },
    // Septiembre 2025
    'pdf-sep-08-14': {
        label: '08 sep 2025 - 14 sep 2025',
        fechaInicio: '2025-09-08',
        fechaFin: '2025-09-14',
        haitianos: 14, multas: 170, motos: 0, llamadas: 14, accidentes: 1, asistencias: 14
    },
    'pdf-sep-22-28': {
        label: '22 sep 2025 - 28 sep 2025',
        fechaInicio: '2025-09-22',
        fechaFin: '2025-09-28',
        haitianos: 12, multas: 192, motos: 0, llamadas: 5, accidentes: 2, asistencias: 5
    },
    // Octubre 2025
    'pdf-oct-05-12': {
        label: '05 oct 2025 - 12 oct 2025',
        fechaInicio: '2025-10-05',
        fechaFin: '2025-10-12',
        haitianos: 13, multas: 148, motos: 0, llamadas: 9, accidentes: 3, asistencias: 2
    },
    'pdf-oct-26-nov-02': {
        label: '26 oct 2025 - 02 nov 2025',
        fechaInicio: '2025-10-26',
        fechaFin: '2025-11-02',
        haitianos: 10, multas: 162, motos: 0, llamadas: 11, accidentes: 2, asistencias: 3
    },
    // Noviembre 2025
    'pdf-nov-10-16': {
        label: '10 nov 2025 - 16 nov 2025',
        fechaInicio: '2025-11-10',
        fechaFin: '2025-11-16',
        haitianos: 3, multas: 109, motos: 0, llamadas: 0, accidentes: 2, asistencias: 5
    },
    'pdf-nov-24-30': {
        label: '24 nov 2025 - 30 nov 2025',
        fechaInicio: '2025-11-24',
        fechaFin: '2025-11-30',
        haitianos: 10, multas: 42, motos: 0, llamadas: 6, accidentes: 1, asistencias: 9
    },
    // Diciembre 2025
    'pdf-dic-01-07': {
        label: '01 dic 2025 - 07 dic 2025',
        fechaInicio: '2025-12-01',
        fechaFin: '2025-12-07',
        haitianos: 0, multas: 0, motos: 0, llamadas: 0, accidentes: 0, asistencias: 0
    },
    'pdf-dic-08-14': {
        label: '08 dic 2025 - 14 dic 2025',
        fechaInicio: '2025-12-08',
        fechaFin: '2025-12-14',
        haitianos: 0, multas: 0, motos: 0, llamadas: 0, accidentes: 0, asistencias: 0
    }
};

// Cargar datos guardados o usar defecto
function getHistoryData() {
    const stored = localStorage.getItem('cjb_history_data');
    return stored ? JSON.parse(stored) : defaultHistoryData;
}

// Integrate historical data into Dashboard
function updateHistoricalDashboard() {
    const rawData = getHistoryData();

    // Sort data by fechaFin chronologically
    const sortedEntries = Object.entries(rawData)
        .filter(([_, d]) => d.fechaFin)
        .sort((a, b) => new Date(a[1].fechaFin) - new Date(b[1].fechaFin));

    // Calculate totals
    let totalMigracion = 0, totalMultas = 0, totalLlamadas = 0, totalAccidentes = 0, totalAsistencias = 0;
    sortedEntries.forEach(([_, d]) => {
        totalMigracion += d.haitianos || 0;
        totalMultas += d.multas || 0;
        totalLlamadas += d.llamadas || 0;
        totalAccidentes += d.accidentes || 0;
        totalAsistencias += d.asistencias || 0;
    });

    // Update Dashboard KPI cards
    const elMultas = document.getElementById('kpiMultasHist');
    const elLlamadas = document.getElementById('kpiLlamadasHist');
    const elAsistencias = document.getElementById('kpiAsistenciasHist');
    if (elMultas) elMultas.textContent = totalMultas;
    if (elLlamadas) elLlamadas.textContent = totalLlamadas;
    if (elAsistencias) elAsistencias.textContent = totalAsistencias;

    // Store historical totals for chart integration
    window.historicalData = {
        migracion: totalMigracion,
        multas: totalMultas,
        llamadas: totalLlamadas,
        accidentes: totalAccidentes,
        asistencias: totalAsistencias,
        digesett: totalMultas + totalAccidentes, // Multas + Accidentes = DIGESETT
        seguridad: totalLlamadas + totalAsistencias // Llamadas + Asistencias = Seguridad
    };

    // REMOVED: Historical data injection into main KPIs
    // KPIs now show ONLY data from Excel/registro (as per user request)
    // Historical data is displayed separately in the "Histórico" section

    /*
    // Add historical values to existing KPIs (Accidentes and Indocumentados) - ACTUAL SUM
    const elAccidentes = document.getElementById('kpiAccidents');
    const elUndoc = document.getElementById('kpiUndocumented');
    if (elAccidentes && !elAccidentes.dataset.historicalAdded) {
        const current = parseInt(elAccidentes.textContent) || 0;
        const total = current + totalAccidentes;
        elAccidentes.textContent = total;
        elAccidentes.dataset.historicalAdded = 'true';
        // Add tooltip
        elAccidentes.title = `Excel: ${current} + Histórico: ${totalAccidentes}`;
    }
    if (elUndoc && !elUndoc.dataset.historicalAdded) {
        const current = parseInt(elUndoc.textContent) || 0;
        const total = current + totalMigracion;
        elUndoc.textContent = total;
        elUndoc.dataset.historicalAdded = 'true';
        // Add tooltip
        elUndoc.title = `Excel: ${current} + Histórico: ${totalMigracion}`;
    }

    // Inject historical data into chartByType if it exists
    injectHistoricalIntoByTypeChart();
    */

    // Format date labels
    const formatDate = (dateStr) => {
        if (!dateStr) return '';
        const d = new Date(dateStr);
        const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
        return `${d.getDate()} ${months[d.getMonth()]}`;
    };

    const dateLabels = sortedEntries.map(([_, d]) => formatDate(d.fechaFin));
    const dsMultas = sortedEntries.map(([_, d]) => d.multas || 0);
    const dsHaitianos = sortedEntries.map(([_, d]) => d.haitianos || 0);

    // Chart 1: Multas Comparison (Horizontal Bar) - Dashboard
    const ctxMultas = document.getElementById('chartMultasHist')?.getContext('2d');
    if (ctxMultas) {
        if (window.dashboardMultasChartInstance) window.dashboardMultasChartInstance.destroy();
        window.dashboardMultasChartInstance = new Chart(ctxMultas, {
            type: 'bar',
            data: {
                labels: dateLabels,
                datasets: [{
                    label: 'Multas',
                    data: dsMultas,
                    backgroundColor: dsMultas.map(v => v > 150 ? '#e74c3c' : v > 100 ? '#f39c12' : '#2ecc71'),
                    borderRadius: 4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                indexAxis: 'y',
                plugins: {
                    legend: { display: false },
                    datalabels: {
                        anchor: 'end',
                        align: 'end',
                        color: '#1E3A5F',
                        font: { weight: 'bold', size: 10 }
                    }
                },
                scales: {
                    x: { beginAtZero: true }
                }
            },
            plugins: [ChartDataLabels]
        });
    }

    // Chart 2: Migration vs Multas Trend - Dashboard
    const ctxTrend = document.getElementById('chartMigracionTrend')?.getContext('2d');
    if (ctxTrend) {
        if (window.dashboardTrendChartInstance) window.dashboardTrendChartInstance.destroy();
        window.dashboardTrendChartInstance = new Chart(ctxTrend, {
            type: 'line',
            data: {
                labels: dateLabels,
                datasets: [
                    {
                        label: 'Migración',
                        data: dsHaitianos,
                        borderColor: '#f39c12',
                        backgroundColor: 'rgba(243, 156, 18, 0.1)',
                        fill: true,
                        tension: 0.3
                    },
                    {
                        label: 'Multas ÷10',
                        data: dsMultas.map(v => v / 10),
                        borderColor: '#e74c3c',
                        backgroundColor: 'rgba(231, 76, 60, 0.1)',
                        fill: true,
                        tension: 0.3
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { position: 'top' },
                    tooltip: {
                        callbacks: {
                            label: (ctx) => {
                                if (ctx.dataset.label === 'Multas ÷10') {
                                    return `Multas: ${ctx.raw * 10}`;
                                }
                                return `${ctx.dataset.label}: ${ctx.raw}`;
                            }
                        }
                    }
                },
                scales: {
                    x: { grid: { display: false } },
                    y: { beginAtZero: true }
                }
            }
        });
    }
}

// Inject historical data into the "Incidentes por Tipo" chart
function injectHistoricalIntoByTypeChart() {
    const chart = window.byTypeChartInstance;
    const histData = window.historicalData;

    if (!chart || !histData) return;

    // Map historical data to chart labels
    const mappings = {
        'Migración': histData.migracion || 0,
        'DIGESETT': (histData.multas || 0) + (histData.accidentes || 0),
        'Seguridad': (histData.llamadas || 0) + (histData.asistencias || 0)
    };

    // Get chart data
    const labels = chart.data.labels;
    const data = chart.data.datasets[0].data;

    // Check if already injected
    if (chart.data.historicalAdded) return;

    // Add historical values to matching labels
    let updated = false;
    labels.forEach((label, index) => {
        if (mappings[label]) {
            data[index] = (data[index] || 0) + mappings[label];
            updated = true;
        }
    });

    if (updated) {
        chart.data.historicalAdded = true;
        chart.update();
        console.log('✅ Historical data injected into byType chart:', mappings);
    }
}

function initHistoryChart() {
    const rawData = getHistoryData();

    // Sort data by fechaFin chronologically
    const sortedEntries = Object.entries(rawData)
        .filter(([_, d]) => d.fechaFin) // Only entries with dates
        .sort((a, b) => new Date(a[1].fechaFin) - new Date(b[1].fechaFin));

    // Format date labels as "DD MMM"
    const formatDate = (dateStr) => {
        if (!dateStr) return '';
        const d = new Date(dateStr);
        const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
        return `${d.getDate()} ${months[d.getMonth()]}`;
    };

    const dateLabels = sortedEntries.map(([_, d]) => formatDate(d.fechaFin));
    const dsHaitianos = sortedEntries.map(([_, d]) => d.haitianos || 0);
    const dsMultas = sortedEntries.map(([_, d]) => d.multas || 0);
    const dsMotos = sortedEntries.map(([_, d]) => d.motos || 0);
    const dsLlamadas = sortedEntries.map(([_, d]) => d.llamadas || 0);
    const dsAccidentes = sortedEntries.map(([_, d]) => d.accidentes || 0);
    const dsAsistencias = sortedEntries.map(([_, d]) => d.asistencias || 0);

    // Update KPI totals
    const totalMigracion = dsHaitianos.reduce((a, b) => a + b, 0);
    const totalMultas = dsMultas.reduce((a, b) => a + b, 0);
    const totalLlamadas = dsLlamadas.reduce((a, b) => a + b, 0);
    const totalAccidentes = dsAccidentes.reduce((a, b) => a + b, 0);
    const totalAsistencias = dsAsistencias.reduce((a, b) => a + b, 0);

    const el1 = document.getElementById('kpiTotalMigracion');
    const el2 = document.getElementById('kpiTotalMultas');
    const el3 = document.getElementById('kpiTotalLlamadas');
    const el4 = document.getElementById('kpiTotalAccidentes');
    const el5 = document.getElementById('kpiTotalAsistencias');
    if (el1) el1.textContent = totalMigracion;
    if (el2) el2.textContent = totalMultas;
    if (el3) el3.textContent = totalLlamadas;
    if (el4) el4.textContent = totalAccidentes;
    if (el5) el5.textContent = totalAsistencias;

    // Chart 1: Timeline Evolution (Area Chart - Main)
    const ctxTimeline = document.getElementById('historyTimelineChart')?.getContext('2d');
    if (ctxTimeline) {
        if (historyChartInstance) historyChartInstance.destroy();
        historyChartInstance = new Chart(ctxTimeline, {
            type: 'line',
            data: {
                labels: dateLabels,
                datasets: [
                    {
                        label: 'Multas',
                        data: dsMultas,
                        borderColor: '#e74c3c',
                        backgroundColor: 'rgba(231, 76, 60, 0.1)',
                        fill: true,
                        tension: 0.4
                    },
                    {
                        label: 'Migración',
                        data: dsHaitianos,
                        borderColor: '#f39c12',
                        backgroundColor: 'rgba(243, 156, 18, 0.1)',
                        fill: true,
                        tension: 0.4
                    },
                    {
                        label: 'Llamadas',
                        data: dsLlamadas,
                        borderColor: '#3498db',
                        backgroundColor: 'rgba(52, 152, 219, 0.1)',
                        fill: true,
                        tension: 0.4
                    },
                    {
                        label: 'Asistencias',
                        data: dsAsistencias,
                        borderColor: '#2ecc71',
                        backgroundColor: 'rgba(46, 204, 113, 0.1)',
                        fill: true,
                        tension: 0.4
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: { mode: 'index', intersect: false },
                plugins: {
                    legend: { position: 'top' },
                    tooltip: {
                        callbacks: {
                            title: (items) => items[0]?.label || ''
                        }
                    }
                },
                scales: {
                    x: {
                        title: { display: true, text: 'Fecha (2025)' },
                        grid: { display: false }
                    },
                    y: { beginAtZero: true, title: { display: true, text: 'Cantidad' } }
                }
            }
        });
    }

    // Chart 2: Multas Comparison (Horizontal Bar)
    const ctxMultas = document.getElementById('historyMultasChart')?.getContext('2d');
    if (ctxMultas) {
        if (window.historyMultasChartInstance) window.historyMultasChartInstance.destroy();
        window.historyMultasChartInstance = new Chart(ctxMultas, {
            type: 'bar',
            data: {
                labels: dateLabels,
                datasets: [{
                    label: 'Multas',
                    data: dsMultas,
                    backgroundColor: dsMultas.map(v => v > 150 ? '#e74c3c' : v > 100 ? '#f39c12' : '#2ecc71'),
                    borderRadius: 6
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                indexAxis: 'y',
                plugins: {
                    legend: { display: false },
                    datalabels: {
                        anchor: 'end',
                        align: 'end',
                        color: '#1E3A5F',
                        font: { weight: 'bold', size: 11 }
                    }
                },
                scales: {
                    x: { beginAtZero: true, title: { display: true, text: 'Cantidad de Multas' } }
                }
            },
            plugins: [ChartDataLabels]
        });
    }

    // Chart 3: Pie Chart (Distribution)
    const ctxPie = document.getElementById('historyPieChart')?.getContext('2d');
    if (ctxPie) {
        if (historyPieChartInstance) historyPieChartInstance.destroy();
        historyPieChartInstance = new Chart(ctxPie, {
            type: 'doughnut',
            data: {
                labels: ['Migración', 'Multas', 'Llamadas', 'Accidentes', 'Asistencias'],
                datasets: [{
                    data: [totalMigracion, totalMultas, totalLlamadas, totalAccidentes, totalAsistencias],
                    backgroundColor: ['#f39c12', '#e74c3c', '#3498db', '#9b59b6', '#2ecc71'],
                    borderWidth: 3,
                    borderColor: '#fff'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { position: 'right' },
                    datalabels: {
                        color: '#fff',
                        font: { weight: 'bold', size: 12 },
                        formatter: (val, ctx) => {
                            let sum = ctx.chart.data.datasets[0].data.reduce((a, b) => a + b, 0);
                            return sum > 0 ? ((val / sum) * 100).toFixed(0) + '%' : '';
                        }
                    }
                },
                cutout: '55%'
            },
            plugins: [ChartDataLabels]
        });
    }

    // Chart 4: Radar Chart (Monthly Patterns)
    const ctxRadar = document.getElementById('historyRadarChart')?.getContext('2d');
    if (ctxRadar) {
        if (window.historyRadarChartInstance) window.historyRadarChartInstance.destroy();

        // Group by month
        const monthlyData = {};
        sortedEntries.forEach(([_, d]) => {
            const month = new Date(d.fechaFin).toLocaleString('es-ES', { month: 'short' });
            if (!monthlyData[month]) {
                monthlyData[month] = { haitianos: 0, multas: 0, llamadas: 0, accidentes: 0, asistencias: 0 };
            }
            monthlyData[month].haitianos += d.haitianos || 0;
            monthlyData[month].multas += d.multas || 0;
            monthlyData[month].llamadas += d.llamadas || 0;
            monthlyData[month].accidentes += d.accidentes || 0;
            monthlyData[month].asistencias += d.asistencias || 0;
        });

        const months = Object.keys(monthlyData);
        window.historyRadarChartInstance = new Chart(ctxRadar, {
            type: 'radar',
            data: {
                labels: ['Migración', 'Multas', 'Llamadas', 'Accidentes', 'Asistencias'],
                datasets: months.map((month, i) => ({
                    label: month.charAt(0).toUpperCase() + month.slice(1),
                    data: [
                        monthlyData[month].haitianos,
                        monthlyData[month].multas / 10, // Scale down multas
                        monthlyData[month].llamadas,
                        monthlyData[month].accidentes,
                        monthlyData[month].asistencias
                    ],
                    borderColor: ['#3498db', '#e74c3c', '#2ecc71', '#f39c12', '#9b59b6', '#1abc9c'][i],
                    backgroundColor: ['rgba(52,152,219,0.1)', 'rgba(231,76,60,0.1)', 'rgba(46,204,113,0.1)', 'rgba(243,156,18,0.1)', 'rgba(155,89,182,0.1)', 'rgba(26,188,156,0.1)'][i],
                    fill: true
                }))
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { position: 'top' } },
                scales: {
                    r: { beginAtZero: true }
                }
            }
        });
    }

    // Chart 5: Trend Chart (Migration vs Multas)
    const ctxTrend = document.getElementById('historyTrendChart')?.getContext('2d');
    if (ctxTrend) {
        if (historyLineChartInstance) historyLineChartInstance.destroy();
        historyLineChartInstance = new Chart(ctxTrend, {
            type: 'line',
            data: {
                labels: dateLabels,
                datasets: [
                    {
                        label: 'Migración',
                        data: dsHaitianos,
                        borderColor: '#f39c12',
                        backgroundColor: '#f39c12',
                        pointRadius: 6,
                        pointHoverRadius: 8,
                        tension: 0.3
                    },
                    {
                        label: 'Multas ÷10',
                        data: dsMultas.map(v => v / 10),
                        borderColor: '#e74c3c',
                        backgroundColor: '#e74c3c',
                        pointRadius: 6,
                        pointHoverRadius: 8,
                        tension: 0.3
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { position: 'top' },
                    tooltip: {
                        callbacks: {
                            label: (ctx) => {
                                if (ctx.dataset.label === 'Multas ÷10') {
                                    return `Multas: ${ctx.raw * 10}`;
                                }
                                return `${ctx.dataset.label}: ${ctx.raw}`;
                            }
                        }
                    }
                },
                scales: {
                    x: { title: { display: true, text: 'Fecha' } },
                    y: { beginAtZero: true, title: { display: true, text: 'Cantidad' } }
                }
            }
        });
    }
}

// Toggle data management section
function toggleDataSection() {
    const content = document.getElementById('dataManagementContent');
    const icon = document.getElementById('dataSectionIcon');
    if (content && icon) {
        content.classList.toggle('collapsed');
        icon.classList.toggle('fa-chevron-down');
        icon.classList.toggle('fa-chevron-up');
    }
}

// Render History Table
function renderHistoryTable() {
    const tbody = document.getElementById('historyTableBody');
    if (!tbody) return;

    const data = getHistoryData();
    tbody.innerHTML = '';

    Object.entries(data).forEach(([id, entry]) => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td><input type="text" value="${entry.label || id}" data-field="label" data-id="${id}" onchange="updateHistoryField(this)"></td>
            <td><input type="number" value="${entry.haitianos || 0}" data-field="haitianos" data-id="${id}" onchange="updateHistoryField(this)" min="0"></td>
            <td><input type="number" value="${entry.multas || 0}" data-field="multas" data-id="${id}" onchange="updateHistoryField(this)" min="0"></td>
            <td><input type="number" value="${entry.motos || 0}" data-field="motos" data-id="${id}" onchange="updateHistoryField(this)" min="0"></td>
            <td><input type="number" value="${entry.llamadas || 0}" data-field="llamadas" data-id="${id}" onchange="updateHistoryField(this)" min="0"></td>
            <td><input type="number" value="${entry.accidentes || 0}" data-field="accidentes" data-id="${id}" onchange="updateHistoryField(this)" min="0"></td>
            <td><input type="number" value="${entry.asistencias || 0}" data-field="asistencias" data-id="${id}" onchange="updateHistoryField(this)" min="0"></td>
            <td><button class="btn-delete-row" onclick="deleteHistoryRow('${id}')" title="Eliminar"><i class="fas fa-trash"></i></button></td>
        `;
        tbody.appendChild(row);
    });
}

// Update individual field in history data
function updateHistoryField(input) {
    const id = input.dataset.id;
    const field = input.dataset.field;
    const value = input.type === 'number' ? parseInt(input.value) || 0 : input.value;

    const data = getHistoryData();
    if (!data[id]) data[id] = {};
    data[id][field] = value;
    localStorage.setItem('cjb_history_data', JSON.stringify(data));

    // Refresh charts
    initHistoryChart();
}

// Add new period row
function addNewHistoryRow() {
    const data = getHistoryData();
    const today = new Date();
    const newId = `custom-${today.getTime()}`;
    const label = `${today.getDate()}/${today.getMonth() + 1}/${today.getFullYear()}`;

    data[newId] = {
        label: label,
        haitianos: 0,
        multas: 0,
        motos: 0,
        llamadas: 0,
        accidentes: 0,
        asistencias: 0
    };

    localStorage.setItem('cjb_history_data', JSON.stringify(data));
    renderHistoryTable();
    initHistoryChart();
    showToast('Nuevo período agregado', 'success');
}

// Delete history row
function deleteHistoryRow(id) {
    showConfirm('Eliminar Período', '¿Está seguro de eliminar este período?', () => {
        const data = getHistoryData();
        delete data[id];
        localStorage.setItem('cjb_history_data', JSON.stringify(data));
        renderHistoryTable();
        initHistoryChart();
        showToast('Período eliminado', 'success');
    });
}

// Clear all history data
function clearAllHistoryData() {
    showConfirm('Limpiar Todo', '¿Está seguro de eliminar todos los datos históricos?', () => {
        localStorage.removeItem('cjb_history_data');
        renderHistoryTable();
        initHistoryChart();
        showToast('Datos históricos eliminados', 'success');
    });
}

// Export history data to JSON
function exportHistoryData() {
    const data = getHistoryData();
    const dataStr = JSON.stringify(data, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `historico_cjb_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('Datos exportados correctamente', 'success');
}

// ============================================
// PDF TEXT EXTRACTION SYSTEM
// ============================================
let extractedPDFData = [];

// Initialize PDF upload handlers
function initPDFUploadHandlers() {
    const uploadZone = document.getElementById('pdfUploadZone');
    const fileInput = document.getElementById('pdfFileInput');

    if (!uploadZone || !fileInput) return;

    // Drag and drop handlers
    uploadZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        uploadZone.classList.add('dragover');
    });

    uploadZone.addEventListener('dragleave', () => {
        uploadZone.classList.remove('dragover');
    });

    uploadZone.addEventListener('drop', (e) => {
        e.preventDefault();
        uploadZone.classList.remove('dragover');
        const files = Array.from(e.dataTransfer.files).filter(f => f.type === 'application/pdf');
        if (files.length > 0) {
            processPDFFiles(files);
        }
    });

    // Click to upload
    uploadZone.addEventListener('click', () => {
        fileInput.click();
    });

    fileInput.addEventListener('change', (e) => {
        const files = Array.from(e.target.files);
        if (files.length > 0) {
            processPDFFiles(files);
        }
    });
}

// Process multiple PDF files
async function processPDFFiles(files) {
    const uploadZone = document.getElementById('pdfUploadZone');
    const processing = document.getElementById('pdfProcessing');
    const results = document.getElementById('pdfExtractionResults');

    uploadZone.style.display = 'none';
    processing.style.display = 'flex';
    results.style.display = 'none';

    extractedPDFData = [];

    for (const file of files) {
        try {
            const text = await extractTextFromPDF(file);
            const parsed = parseReportText(text, file.name);
            if (parsed) {
                extractedPDFData.push(parsed);
            }
        } catch (error) {
            console.error('Error processing PDF:', file.name, error);
        }
    }

    processing.style.display = 'none';

    if (extractedPDFData.length > 0) {
        displayExtractionResults();
        results.style.display = 'block';
        showToast(`${extractedPDFData.length} PDF(s) procesados`, 'success');
    } else {
        uploadZone.style.display = 'flex';
        showToast('No se pudo extraer datos de los PDFs', 'warning');
    }
}

// Extract text from PDF using PDF.js
async function extractTextFromPDF(file) {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    let fullText = '';

    for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        const pageText = textContent.items.map(item => item.str).join(' ');
        fullText += pageText + '\n';
    }

    return fullText;
}

// Parse report text to extract data with CORRECT business logic
function parseReportText(text, filename) {
    // Clean and normalize text
    const cleanText = text
        .replace(/\r\n/g, '\n')
        .replace(/\s+/g, ' ')
        .toLowerCase()
        .trim();

    console.log('=== PDF EXTRACTION DEBUG ===');
    console.log('Filename:', filename);
    console.log('Text length:', cleanText.length);

    // Try to extract date from filename or text
    let period = extractPeriodFromFilename(filename) || extractPeriodFromText(text);
    console.log('Extracted period:', period);

    const result = {
        label: period || filename.replace('.pdf', '').replace('.PDF', ''),
        haitianos: 0,  // Migración: Nacionales haitianos detenidos/entregados
        multas: 0,     // Fiscalizaciones de tránsito + violaciones de moto (giro prohibido, no casco, etc)
        motos: 0,      // Solo retenciones FÍSICAS de motocicletas
        llamadas: 0,   // Llamadas telefónicas atendidas a ciudadanos
        accidentes: 0, // Accidentes de tránsito
        asistencias: 0, // Asistencias, auxilios, depuraciones de vehículos
        source: filename
    };

    // ========================================
    // 1. MIGRACIÓN / HAITIANOS
    // ========================================
    // Patterns: "total de (2)" haitianos, "27 Nacionales Haitianos"
    const haitianosPatterns = [
        /total de \(?(\d+)\)?\s*\.?\s*$/gm,  // "total de (2)." at end
        /un total de (\d+)\s*nacionales?\s*haitiano/gi,
        /\(?(\d+)\)?\s*nacionales?\s*haitiano/gi,
        /haitiano[s]?.*?total.*?\(?(\d+)\)?/gi,
        /\(?(\d+)\)?\s*indocumentado/gi
    ];
    haitianosPatterns.forEach(pattern => {
        const matches = [...cleanText.matchAll(pattern)];
        matches.forEach(m => {
            const val = parseInt(m[1]) || 0;
            if (val > 0 && val < 500 && val > result.haitianos) {
                // Verify context mentions haitianos/migración
                const pos = m.index;
                const context = cleanText.substring(Math.max(0, pos - 150), pos + 50);
                if (context.includes('haitiano') || context.includes('nacionales') || context.includes('migra') || context.includes('indocumentado')) {
                    result.haitianos = val;
                    console.log('Haitianos:', val, 'from pattern');
                }
            }
        });
    });

    // ========================================
    // 2. MULTAS / FISCALIZACIONES
    // PRINCIPAL: "total de X en toda la semana" junto a contexto de tránsito
    // ========================================

    // FIRST PRIORITY: "total de X en toda la semana" - this is the main multas number
    const totalSemanaMatch = cleanText.match(/total de (\d+)\s*en toda la semana/i);
    if (totalSemanaMatch) {
        result.multas = parseInt(totalSemanaMatch[1]) || 0;
        console.log('Multas (total semana):', result.multas);
    }

    // SECOND: Check for "X fiscalizaciones" if no total found
    if (result.multas === 0) {
        const fiscalizacionMatch = cleanText.match(/(\d+)\s*fiscalizacion/i);
        if (fiscalizacionMatch) {
            result.multas = parseInt(fiscalizacionMatch[1]) || 0;
            console.log('Multas (fiscalizaciones):', result.multas);
        }
    }

    // ADD motorcycle violations ONLY if they are explicitly listed
    // "giro prohibido", "no casco", "vía contraria" - these ADD to multas
    let motoViolations = 0;
    const giroMatch = cleanText.match(/(\d+)\s*giro prohibido/i);
    const noCascoMatch = cleanText.match(/(\d+)\s*no casco/i);
    const viaMatch = cleanText.match(/(\d+)\s*v[ií]a contraria/i);

    if (giroMatch) motoViolations += parseInt(giroMatch[1]) || 0;
    if (noCascoMatch) motoViolations += parseInt(noCascoMatch[1]) || 0;
    if (viaMatch) motoViolations += parseInt(viaMatch[1]) || 0;

    // Only add moto violations if they were found AND are separate from main count
    if (motoViolations > 0 && result.multas === 0) {
        result.multas = motoViolations;
        console.log('Multas (violaciones moto):', motoViolations);
    }

    // ========================================
    // 3. MOTOS - SOLO RETENCIONES FÍSICAS
    // ========================================
    let motosRetenidas = 0;
    const motosMatches = cleanText.matchAll(/\(?(\d+)\)?\s*motocicleta[s]?\s*retenida/gi);
    [...motosMatches].forEach(m => {
        motosRetenidas += parseInt(m[1]) || 0;
    });
    result.motos = motosRetenidas;
    console.log('Motos retenidas:', result.motos);

    // ========================================
    // 4. LLAMADAS - SOLO si dice explícitamente "llamadas atendidas a ciudadanos"
    // ========================================
    // STRICT: Only match "total de X llamadas atendidas" or "X llamadas atendidas a ciudadanos"
    const llamadasStrictMatch = cleanText.match(/total de (\d+)\s*llamadas?\s*atendida/i) ||
        cleanText.match(/(\d+)\s*llamadas?\s*atendidas?\s*a\s*ciudadano/i);
    if (llamadasStrictMatch) {
        result.llamadas = parseInt(llamadasStrictMatch[1]) || 0;
        console.log('Llamadas (strict):', result.llamadas);
    }
    // Note: If no explicit llamadas pattern found, leave as 0

    // ========================================
    // 5. ACCIDENTES - SOLO si dice explícitamente "X accidentes" en contexto de estadísticas
    // ========================================
    // STRICT: Only match "X accidentes" or "X accidente" when preceded by a number indicator
    const accidenteStrictMatch = cleanText.match(/➢\s*(\d+)\s*accidente/i) ||
        cleanText.match(/•\s*(\d+)\s*accidente/i) ||
        cleanText.match(/^\s*(\d+)\s*accidente/im);
    if (accidenteStrictMatch) {
        result.accidentes = parseInt(accidenteStrictMatch[1]) || 0;
        console.log('Accidentes (strict):', result.accidentes);
    }
    // Note: If no explicit pattern found, leave as 0

    // ========================================
    // 6. ASISTENCIAS - SOLO "X asistencias" explícito
    // ========================================
    // STRICT: Only match "X asistencias" with bullet or number context
    const asistStrictMatch = cleanText.match(/➢\s*(\d+)\s*asistencia/i) ||
        cleanText.match(/•\s*(\d+)\s*asistencia/i) ||
        cleanText.match(/(\d+)\s*asistencias?\s*\./i);
    if (asistStrictMatch) {
        result.asistencias = parseInt(asistStrictMatch[1]) || 0;
        console.log('Asistencias (strict):', result.asistencias);
    }
    // Note: Don't add depuraciones - they might be counted in multas

    console.log('=== FINAL RESULT ===', result);

    // Only return if we extracted at least some data
    const hasData = result.haitianos > 0 || result.multas > 0 || result.motos > 0 ||
        result.llamadas > 0 || result.accidentes > 0 || result.asistencias > 0;

    return hasData ? result : null;
}

// Extract best (highest) value from patterns with debug
function extractBestValue(text, patterns, field) {
    let maxValue = 0;
    patterns.forEach(pattern => {
        const matches = [...text.matchAll(pattern)];
        matches.forEach(match => {
            const value = parseInt(match[1]) || 0;
            if (value > maxValue && value < 5000) {
                console.log(`${field}: Found ${value} with pattern ${pattern}`);
                maxValue = value;
            }
        });
    });
    return maxValue;
}

// Extract sum of all values found with debug
function extractAllSum(text, patterns, field) {
    let total = 0;
    patterns.forEach(pattern => {
        const matches = [...text.matchAll(pattern)];
        matches.forEach(match => {
            const value = parseInt(match[1]) || 0;
            if (value > 0 && value < 5000) {
                console.log(`${field}: Adding ${value} with pattern ${pattern}`);
                total += value;
            }
        });
    });
    return total;
}

// Extract sum of all values (for cumulative counts like motos)
function extractSumValue(text, patterns) {
    let total = 0;
    patterns.forEach(pattern => {
        const matches = [...text.matchAll(pattern)];
        matches.forEach(match => {
            const value = parseInt(match[1]) || 0;
            if (value > 0 && value < 10000) {
                total += value;
            }
        });
    });
    return total;
}

// Extract period from filename
function extractPeriodFromFilename(filename) {
    // Patterns: "1-12-2025", "04-12-2025", "21 al 27 de Julio"
    const patterns = [
        /(\d{1,2})-(\d{1,2})-(\d{4})/,
        /(\d{1,2})\/(\d{1,2})\/(\d{4})/,
        /(\d{1,2})\s*al\s*(\d{1,2})\s*de\s*(\w+)/i,
        /del\s*(\d{1,2})\s*al\s*(\d{1,2})\s*de\s*(\w+)/i
    ];

    for (const pattern of patterns) {
        const match = filename.match(pattern);
        if (match) {
            return match[0];
        }
    }
    return null;
}

// Extract period from text content
function extractPeriodFromText(text) {
    // Look for date patterns in first 1000 characters
    const firstPart = text.substring(0, 1000);

    // Patterns based on real PDFs:
    // "17 de Noviembre del 2025"
    // "1 de Diciembre del 2025"
    // "desde el 21 al 27 de Julio del 2025"
    // "04 de noviembre del 2025"
    const patterns = [
        /desde\s*el\s*(\d{1,2})\s*al\s*(\d{1,2})\s*de\s*(\w+)\s*del?\s*(\d{4})/i,
        /del\s*(\d{1,2})\s*al\s*(\d{1,2})\s*de\s*(\w+)\s*del?\s*(\d{4})/i,
        /(\d{1,2})\s*de\s*(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre)\s*del?\s*(\d{4})/i
    ];

    for (const pattern of patterns) {
        const match = firstPart.match(pattern);
        if (match) {
            return match[0];
        }
    }
    return null;
}

// Display extraction results
function displayExtractionResults() {
    const preview = document.getElementById('extractedDataPreview');
    preview.innerHTML = '';

    extractedPDFData.forEach((data, index) => {
        const card = document.createElement('div');
        card.className = 'extracted-period-card';
        card.innerHTML = `
            <div class="extracted-period-header">
                <span class="extracted-period-title">${data.label}</span>
                <small style="color: var(--text-muted);">${data.source}</small>
            </div>
            <div class="extracted-period-grid">
                <div class="extracted-field">
                    <label>Migración</label>
                    <input type="number" id="ext_${index}_haitianos" value="${data.haitianos}" min="0">
                </div>
                <div class="extracted-field">
                    <label>Multas</label>
                    <input type="number" id="ext_${index}_multas" value="${data.multas}" min="0">
                </div>
                <div class="extracted-field">
                    <label>Motos</label>
                    <input type="number" id="ext_${index}_motos" value="${data.motos}" min="0">
                </div>
                <div class="extracted-field">
                    <label>Llamadas</label>
                    <input type="number" id="ext_${index}_llamadas" value="${data.llamadas}" min="0">
                </div>
                <div class="extracted-field">
                    <label>Accidentes</label>
                    <input type="number" id="ext_${index}_accidentes" value="${data.accidentes}" min="0">
                </div>
                <div class="extracted-field">
                    <label>Asistencias</label>
                    <input type="number" id="ext_${index}_asistencias" value="${data.asistencias}" min="0">
                </div>
            </div>
        `;
        preview.appendChild(card);
    });
}

// Apply extracted data to history table
function applyExtractedData() {
    const historyData = getHistoryData();

    extractedPDFData.forEach((data, index) => {
        // Get updated values from inputs
        const id = `pdf-${Date.now()}-${index}`;
        historyData[id] = {
            label: data.label,
            haitianos: parseInt(document.getElementById(`ext_${index}_haitianos`)?.value) || data.haitianos,
            multas: parseInt(document.getElementById(`ext_${index}_multas`)?.value) || data.multas,
            motos: parseInt(document.getElementById(`ext_${index}_motos`)?.value) || data.motos,
            llamadas: parseInt(document.getElementById(`ext_${index}_llamadas`)?.value) || data.llamadas,
            accidentes: parseInt(document.getElementById(`ext_${index}_accidentes`)?.value) || data.accidentes,
            asistencias: parseInt(document.getElementById(`ext_${index}_asistencias`)?.value) || data.asistencias
        };
    });

    localStorage.setItem('cjb_history_data', JSON.stringify(historyData));
    renderHistoryTable();
    initHistoryChart();
    clearExtractionResults();
    showToast(`${extractedPDFData.length} período(s) agregados`, 'success');
}

// Clear extraction results
function clearExtractionResults() {
    const uploadZone = document.getElementById('pdfUploadZone');
    const results = document.getElementById('pdfExtractionResults');
    const fileInput = document.getElementById('pdfFileInput');

    results.style.display = 'none';
    uploadZone.style.display = 'flex';
    fileInput.value = '';
    extractedPDFData = [];
}

// ============================================
// PDF FILES LIST FROM FOLDER
// ============================================

// All PDF files from "Incidentes antiguos" folder
const knownPDFFiles = [
    { id: 'pdf-dic-01-07', name: 'Resumen Semanal 01-07 Diciembre 2025', path: 'Incidentes antiguos/Resumen  Semanal del 01 al 7 de Dicciembre del Trabajo Realizado por la Dirección de Seguridad.pdf' },
    { id: 'pdf-nov-11-16', name: 'Resumen Semanal 11-16 Noviembre 2025', path: 'Incidentes antiguos/Resumen  Semanal del 11 al 16 de NOVIEMBRE del Trabajo Realizado por la Dirección de Seguridad.pdf' },
    { id: 'pdf-nov-27-02', name: 'Resumen Semanal 27 Oct - 02 Nov 2025', path: 'Incidentes antiguos/RESUMEN  DEL 27 AL 02 DE NOVIEMBRE DEL AÑO 2025 DEL TRABAJO REALIZADO POR LA DIRECCION DE SEGURIDA.pdf' },
    { id: 'pdf-oct-06-12', name: 'Resumen Semanal 06-12 Octubre 2025', path: 'Incidentes antiguos/Resumen  Semanal del 06 al 12 de OCTUBRE del Trabajo Realizado por la Dirección de Seguridad d.pdf' },
    { id: 'pdf-sep-08-14', name: 'Resumen Semanal 08-14 Septiembre 2025', path: 'Incidentes antiguos/Resumen  Semanal del 08 al 14 de septiembre del Trabajo Realizado por la Dirección de Seguridad de.pdf' },
    { id: 'pdf-sep-22-28', name: 'Resumen Semanal 22-28 Septiembre 2025', path: 'Incidentes antiguos/Resumen Semanal desde el 22 al 28 de Septiembre del año 2025 del Trabajo Realizado por la Direcció.pdf' },
    { id: 'pdf-ago-25-31', name: 'Resumen Semanal 25-31 Agosto 2025', path: 'Incidentes antiguos/Resumen Semanal del 25 al 31 de agosto del año 2025 del Trabajo Realizado por la Dirección de Segu.pdf' },
    { id: 'pdf-jul-28-ago-03', name: 'Resumen Semanal 28 Jul - 03 Ago 2025', path: 'Incidentes antiguos/Resumen Semanal del 28 de julio al 03 de agosto del Trabajo Realizado por la Dirección de Segurida.pdf' },
    { id: 'pdf-jul-21-27', name: 'Resumen Semanal 21-27 Julio 2025', path: 'Incidentes antiguos/Resumen Semanal del Trabajo Realizado dedes el 21 al 27 de julio del año 2025 por la Di.pdf' },
    { id: 'pdf-jul-14-21', name: 'Resumen Semanal 14-21 Julio 2025', path: 'Incidentes antiguos/Resumen Semanal del 14 al 21 de Julio del 2025 del Trabajo Realizado por la Dirección de Segurida[.pdf' },
    { id: 'pdf-parte-dic', name: 'Parte Diario 01-07 Diciembre 2025', path: 'Incidentes antiguos/PARTE DIARIO DEL 1 AL 7 DE DICIEMBRE DEL AÑO 2025 DEL TRABAJO REALIZADO POR LA DIRECCION DE SE.pdf' },
    { id: 'pdf-parte-nov', name: 'Parte Diario 11-16 Noviembre 2025', path: 'Incidentes antiguos/PARTE DIARIO DEL 11 AL 16 DE NOVIEMBRE DEL AÑO 2025 DEL TRABAJO REALIZADO POR LA DIRECCION DE .pdf' }
];

// Render PDF files list with manual entry buttons
function renderPDFFileList() {
    const container = document.getElementById('pdfFilesList');
    if (!container) return;

    const historyData = getHistoryData();

    if (knownPDFFiles.length === 0) {
        container.innerHTML = `
            <div class="pdf-files-empty">
                <i class="fas fa-folder-open"></i>
                <p>No hay archivos PDF configurados</p>
            </div>
        `;
        return;
    }

    container.innerHTML = knownPDFFiles.map((file) => {
        const hasData = historyData[file.id] && (
            historyData[file.id].haitianos > 0 ||
            historyData[file.id].multas > 0 ||
            historyData[file.id].motos > 0
        );
        const statusClass = hasData ? 'has-data' : '';
        const statusIcon = hasData ? '<i class="fas fa-check-circle" style="color: var(--accent-green);"></i>' : '';

        return `
        <div class="pdf-file-item ${statusClass}">
            <i class="fas fa-file-pdf"></i>
            <div class="pdf-file-info">
                <div class="pdf-file-name">${file.name} ${statusIcon}</div>
            </div>
            <div class="pdf-file-actions">
                <button class="btn btn-sm btn-secondary" onclick="openPDFFile('${file.path.replace(/'/g, "\\'")}'); event.stopPropagation();" title="Abrir PDF">
                    <i class="fas fa-external-link-alt"></i>
                </button>
                <button class="btn btn-sm btn-primary" onclick="openPDFDataEntry('${file.id}', '${file.name.replace(/'/g, "\\'")}'); event.stopPropagation();" title="Ingresar Datos">
                    <i class="fas fa-edit"></i>
                </button>
            </div>
        </div>
    `;
    }).join('');
}

// Open PDF data entry modal
function openPDFDataEntry(fileId, fileName) {
    const historyData = getHistoryData();
    const entry = historyData[fileId] || {
        label: fileName,
        fechaInicio: '',
        fechaFin: '',
        haitianos: 0,
        multas: 0,
        motos: 0,
        llamadas: 0,
        accidentes: 0,
        asistencias: 0
    };

    // Create modal dynamically
    let modal = document.getElementById('pdfDataEntryModal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'pdfDataEntryModal';
        modal.className = 'modal-overlay';
        document.body.appendChild(modal);
    }

    modal.innerHTML = `
        <div class="modal-content" style="max-width: 550px;">
            <div class="modal-header">
                <h3><i class="fas fa-edit"></i> Ingresar Datos del Reporte</h3>
                <button class="btn btn-icon" onclick="closePDFDataEntry()">
                    <i class="fas fa-times"></i>
                </button>
            </div>
            <div class="modal-body">
                <p style="margin-bottom: 15px; color: var(--primary); font-weight: 600;"><i class="fas fa-file-pdf"></i> ${fileName}</p>
                <input type="hidden" id="pdfEntryId" value="${fileId}">
                <input type="hidden" id="pdfEntryName" value="${fileName}">
                
                <!-- Date Range Section -->
                <div style="background: rgba(30, 58, 95, 0.05); padding: 15px; border-radius: 8px; margin-bottom: 20px;">
                    <label style="font-weight: 600; margin-bottom: 10px; display: block;"><i class="fas fa-calendar-alt"></i> Período del Reporte</label>
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
                        <div class="form-group" style="margin-bottom: 0;">
                            <label>Fecha Inicio</label>
                            <input type="date" id="pdfEntryFechaInicio" value="${entry.fechaInicio || ''}">
                        </div>
                        <div class="form-group" style="margin-bottom: 0;">
                            <label>Fecha Fin</label>
                            <input type="date" id="pdfEntryFechaFin" value="${entry.fechaFin || ''}">
                        </div>
                    </div>
                </div>
                
                <!-- Data Fields -->
                <label style="font-weight: 600; margin-bottom: 10px; display: block;"><i class="fas fa-chart-bar"></i> Datos Estadísticos</label>
                <div class="form-grid" style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px;">
                    <div class="form-group">
                        <label>Migración</label>
                        <input type="number" id="pdfEntryHaitianos" value="${entry.haitianos}" min="0">
                    </div>
                    <div class="form-group">
                        <label>Multas</label>
                        <input type="number" id="pdfEntryMultas" value="${entry.multas}" min="0">
                    </div>
                    <div class="form-group">
                        <label>Motos</label>
                        <input type="number" id="pdfEntryMotos" value="${entry.motos}" min="0">
                    </div>
                    <div class="form-group">
                        <label>Llamadas</label>
                        <input type="number" id="pdfEntryLlamadas" value="${entry.llamadas}" min="0">
                    </div>
                    <div class="form-group">
                        <label>Accidentes</label>
                        <input type="number" id="pdfEntryAccidentes" value="${entry.accidentes}" min="0">
                    </div>
                    <div class="form-group">
                        <label>Asistencias</label>
                        <input type="number" id="pdfEntryAsistencias" value="${entry.asistencias}" min="0">
                    </div>
                </div>
            </div>
            <div class="modal-footer" style="display: flex; gap: 10px; justify-content: flex-end; padding: 15px 20px; border-top: 1px solid var(--border-color);">
                <button class="btn btn-secondary" onclick="closePDFDataEntry()">Cancelar</button>
                <button class="btn btn-primary" onclick="savePDFDataEntry()">
                    <i class="fas fa-save"></i> Guardar
                </button>
            </div>
        </div>
    `;

    // Show modal using display style
    modal.style.display = 'flex';
    modal.style.justifyContent = 'center';
    modal.style.alignItems = 'center';
    modal.classList.add('active');
}

// Close PDF data entry modal
function closePDFDataEntry() {
    const modal = document.getElementById('pdfDataEntryModal');
    if (modal) {
        modal.style.display = 'none';
        modal.classList.remove('active');
    }
}

// Save PDF data entry
function savePDFDataEntry() {
    const fileId = document.getElementById('pdfEntryId').value;
    const fileName = document.getElementById('pdfEntryName').value;
    const fechaInicio = document.getElementById('pdfEntryFechaInicio').value;
    const fechaFin = document.getElementById('pdfEntryFechaFin').value;

    // Format label with dates if provided
    let label = fileName;
    if (fechaInicio && fechaFin) {
        const inicio = new Date(fechaInicio);
        const fin = new Date(fechaFin);
        const options = { day: '2-digit', month: 'short', year: 'numeric' };
        label = `${inicio.toLocaleDateString('es-ES', options)} - ${fin.toLocaleDateString('es-ES', options)}`;
    }

    const historyData = getHistoryData();
    historyData[fileId] = {
        label: label,
        fechaInicio: fechaInicio,
        fechaFin: fechaFin,
        haitianos: parseInt(document.getElementById('pdfEntryHaitianos').value) || 0,
        multas: parseInt(document.getElementById('pdfEntryMultas').value) || 0,
        motos: parseInt(document.getElementById('pdfEntryMotos').value) || 0,
        llamadas: parseInt(document.getElementById('pdfEntryLlamadas').value) || 0,
        accidentes: parseInt(document.getElementById('pdfEntryAccidentes').value) || 0,
        asistencias: parseInt(document.getElementById('pdfEntryAsistencias').value) || 0
    };

    localStorage.setItem('cjb_history_data', JSON.stringify(historyData));

    closePDFDataEntry();
    renderPDFFileList();
    renderHistoryTable();
    initHistoryChart();
    showToast('Datos guardados correctamente', 'success');
}

// Open a PDF file
function openPDFFile(path) {
    window.open(path, '_blank');
}

// Refresh PDF file list
function refreshPDFFileList() {
    renderPDFFileList();
    showToast('Lista actualizada', 'info');
}

// Modal Logic
function openManualEntryModal(reportName, reportId) {
    document.getElementById('modalReportName').textContent = reportName;
    document.getElementById('modalReportId').value = reportId;

    const data = getHistoryData();
    const entry = data[reportId] || { haitianos: 0, multas: 0, motos: 0, llamadas: 0, accidentes: 0, asistencias: 0 };

    document.getElementById('inputHaitianos').value = entry.haitianos || 0;
    document.getElementById('inputMultas').value = entry.multas || 0;
    document.getElementById('inputMotos').value = entry.motos || 0;
    document.getElementById('inputLlamadas').value = entry.llamadas || 0;
    document.getElementById('inputAccidentes').value = entry.accidentes || 0;
    document.getElementById('inputAsistencias').value = entry.asistencias || 0;

    document.getElementById('manualDataModal').classList.add('active');
}

function closeManualDataModal() {
    document.getElementById('manualDataModal').classList.remove('active');
}

function saveManualData() {
    const reportId = document.getElementById('modalReportId').value;
    const currentData = getHistoryData();

    if (!currentData[reportId]) currentData[reportId] = { label: reportId };

    currentData[reportId].haitianos = parseInt(document.getElementById('inputHaitianos').value) || 0;
    currentData[reportId].multas = parseInt(document.getElementById('inputMultas').value) || 0;
    currentData[reportId].motos = parseInt(document.getElementById('inputMotos').value) || 0;
    currentData[reportId].llamadas = parseInt(document.getElementById('inputLlamadas').value) || 0;
    currentData[reportId].accidentes = parseInt(document.getElementById('inputAccidentes').value) || 0;
    currentData[reportId].asistencias = parseInt(document.getElementById('inputAsistencias').value) || 0;

    localStorage.setItem('cjb_history_data', JSON.stringify(currentData));

    showToast('Datos guardados correctamente', 'success');
    closeManualDataModal();
    initHistoryChart();
}


// Hook into Navigation to load charts
const originalNavInit = Navigation.init;
Navigation.init = function () {
    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const pageId = item.dataset.page;

            // Block navigation if no data loaded (except for historyPage which uses manual data)
            if (DataStore.rawData.length === 0 && pageId !== 'uploadSection' && pageId !== 'historyPage') {
                showConfirm(
                    '📂 Archivo Requerido',
                    'Debe cargar un archivo de datos para acceder a esta sección. ¿Desea ir a la zona de carga?',
                    () => {
                        showUploadSection();
                    }
                );
                return;
            }

            document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
            document.querySelectorAll('.page-section').forEach(s => s.style.display = 'none');

            item.classList.add('active');
            document.getElementById(pageId).style.display = 'block';

            if (window.innerWidth <= 768) {
                document.querySelector('.sidebar').classList.remove('active');
            }

            if (pageId === 'historyPage') setTimeout(() => { renderHistoryTable(); initHistoryChart(); initPDFUploadHandlers(); renderPDFFileList(); }, 100);
            if (pageId === 'analyticsPage') {
                setTimeout(() => {
                    ChartManager.renderAnalytics();
                }, 100);
            }
        });
    });
};

function downloadSummaryPDF() {
    const element = document.querySelector('#summaryModal .summary-content'); // Selector específico
    if (!element) return;

    // Hide buttons temporarily
    const actions = element.querySelector('.summary-actions');
    const originalDisplay = actions ? actions.style.display : '';
    if (actions) actions.style.display = 'none';

    showToast('Generando PDF del Resumen...', 'info');

    const opt = {
        margin: 10,
        filename: `Resumen_Ejecutivo_CJB_${new Date().toISOString().slice(0, 10)}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true, logging: false },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };

    html2pdf().set(opt).from(element).save().then(() => {
        if (actions) actions.style.display = originalDisplay; // Restore
        showToast('Resumen descargado', 'success');
    }).catch(err => {
        if (actions) actions.style.display = originalDisplay; // Restore
        console.error(err);
        showToast('Error al descargar resumen', 'error');
    });
}

// New Exports
window.openManualEntryModal = openManualEntryModal;
window.closeManualDataModal = closeManualDataModal;
window.saveManualData = saveManualData;
window.downloadSummaryPDF = downloadSummaryPDF;

// Function to show upload section from sidebar button
function showUploadSection() {
    // Hide all pages
    document.querySelectorAll('.page-section').forEach(p => p.style.display = 'none');
    // Show upload section
    document.getElementById('uploadSection').style.display = 'flex';
    // Close sidebar on mobile
    if (window.innerWidth <= 768) {
        document.getElementById('sidebar')?.classList.remove('open');
    }
}

// Global exports
window.viewIncident = viewIncident;
window.removeCrossFilter = removeCrossFilter;
window.exportToExcel = exportToExcel;
window.exportToPDF = exportToPDF;
window.generateExecutiveSummary = generateExecutiveSummary;
window.closeSummaryModal = closeSummaryModal;
window.printSummary = printSummary;
window.printIncidentReport = printIncidentReport;
window.TableManager = TableManager;
window.showUploadSection = showUploadSection;
window.openManualEntryModal = openManualEntryModal;
window.closeManualDataModal = closeManualDataModal;
window.saveManualData = saveManualData;
// History table functions
window.addNewHistoryRow = addNewHistoryRow;
window.updateHistoryField = updateHistoryField;
window.deleteHistoryRow = deleteHistoryRow;
window.clearAllHistoryData = clearAllHistoryData;
window.exportHistoryData = exportHistoryData;
window.renderHistoryTable = renderHistoryTable;
// PDF extraction functions
window.initPDFUploadHandlers = initPDFUploadHandlers;
window.processPDFFiles = processPDFFiles;
window.applyExtractedData = applyExtractedData;
window.clearExtractionResults = clearExtractionResults;
// PDF file list functions
window.renderPDFFileList = renderPDFFileList;
window.openPDFFile = openPDFFile;
window.refreshPDFFileList = refreshPDFFileList;
window.openPDFDataEntry = openPDFDataEntry;
window.closePDFDataEntry = closePDFDataEntry;
window.savePDFDataEntry = savePDFDataEntry;
window.toggleDataSection = toggleDataSection;
window.updateHistoricalDashboard = updateHistoricalDashboard;

// Auto-load historical data on page load
setTimeout(() => {
    if (document.getElementById('kpiMultasHist')) {
        updateHistoricalDashboard();
    }
}, 800);

// ============================================
// INTERACTIVE SECURITY MAP FUNCTIONS
// ============================================

// Quadrant color mapping
const quadrantColors = {
    'B1': '#e74c3c',
    'B2': '#2ecc71',
    'B3': '#f1c40f',
    'B4': '#3498db'
};

// Get dynamic stats for a quadrant
function getQuadrantStats(quadrant) {
    const data = DataStore.filteredData || [];
    const quadrantData = data.filter(r => r.quadrant === quadrant);
    const officers = new Set(quadrantData.map(r => r.officer).filter(o => o && o !== 'No especificado'));

    return {
        incidents: quadrantData.length,
        officers: officers.size,
        status: quadrantData.length > 10 ? 'Alta Actividad' : quadrantData.length > 5 ? 'Moderado' : 'Normal'
    };
}

// Show tooltip for quadrant hover
function showQuadrantTooltip(event, quadrant) {
    const tooltip = document.getElementById('quadrantTooltip');
    const header = document.getElementById('tooltipHeader');
    const statusEl = document.getElementById('tooltipStatus');
    const incidentsEl = document.getElementById('tooltipIncidents');
    const officersEl = document.getElementById('tooltipOfficers');

    if (!tooltip) return;

    // Get stats
    const stats = getQuadrantStats(quadrant);

    // Update tooltip content
    header.textContent = `Cuadrante ${quadrant}`;
    header.style.borderColor = quadrantColors[quadrant];
    statusEl.textContent = stats.status;
    statusEl.style.color = stats.status === 'Alta Actividad' ? '#ff6b6b' : stats.status === 'Moderado' ? '#ffd93d' : '#6bcb77';
    incidentsEl.textContent = stats.incidents;
    officersEl.textContent = stats.officers;

    // Position tooltip near cursor
    const x = event.clientX + 15;
    const y = event.clientY + 15;

    tooltip.style.left = x + 'px';
    tooltip.style.top = y + 'px';
    tooltip.style.display = 'block';
}

// Hide tooltip
function hideQuadrantTooltip() {
    const tooltip = document.getElementById('quadrantTooltip');
    if (tooltip) {
        tooltip.style.display = 'none';
    }
}

// Filter dashboard by quadrant (cross-filter)
function filterByQuadrant(quadrant) {
    DataStore.setCrossFilter('quadrant', quadrant);
    hideQuadrantTooltip();
}

// Current quadrant for modal
let currentQuadrant = null;

// Open quadrant modal with stats
function openQuadrantModal(quadrant) {
    currentQuadrant = quadrant;
    const modal = document.getElementById('quadrantModal');
    const header = document.getElementById('quadrantModalHeader');
    const title = document.getElementById('modalQuadrantTitle');

    if (!modal) return;

    // Get stats
    let data = DataStore.filteredData;

    // If no filtered data (and presumably no active filters), try raw data
    // This fixes issue where stats show 0 on initial load if filteredData isn't populated yet
    if ((!data || data.length === 0) && DataStore.rawData && DataStore.rawData.length > 0) {
        console.log('Using rawData for quadrant modal as filteredData is empty');
        data = DataStore.rawData;
    }

    data = data || [];
    console.log(`Open Quadrant ${quadrant}. Total Data Points: ${data.length}`);

    const quadrantData = data.filter(r => r.quadrant === quadrant);
    console.log(`Data for ${quadrant}:`, quadrantData.length);

    const totalData = data.length;

    // Calculate unique officers
    const officers = new Set();
    quadrantData.forEach(r => {
        if (r.officer && r.officer !== 'No especificado') {
            officers.add(r.officer);
        }
    });

    // Safely sum undocumented count
    const undocumented = quadrantData.reduce((sum, r) => {
        const val = parseInt(r.undocumented);
        return sum + (isNaN(val) ? 0 : val);
    }, 0);

    const percentage = totalData > 0 ? ((quadrantData.length / totalData) * 100).toFixed(1) : '0';

    // Status Logic
    let status = 'Normal';
    let statusColor = '#6bcb77';
    if (quadrantData.length > 15) {
        status = 'Alta Actividad';
        statusColor = '#ff6b6b';
    } else if (quadrantData.length > 5) {
        status = 'Moderado';
        statusColor = '#ffd93d';
    }

    // Update modal content
    title.textContent = `Cuadrante ${quadrant}`;
    header.style.borderBottom = `3px solid ${quadrantColors[quadrant]}`;

    document.getElementById('modalIncidents').textContent = quadrantData.length;
    document.getElementById('modalUndocumented').textContent = undocumented;
    document.getElementById('modalOfficers').textContent = officers.size;
    document.getElementById('modalPercentage').textContent = `${percentage}%`;

    const statusEl = document.getElementById('modalStatus');
    statusEl.innerHTML = `<i class="fas fa-circle" style="color:${statusColor}"></i> Estado: <strong>${status}</strong>`;

    // Show modal
    modal.style.display = 'flex';
}

// Close quadrant modal
function closeQuadrantModal(event) {
    if (event && event.target && event.target.id !== 'quadrantModal') return;
    const modal = document.getElementById('quadrantModal');
    if (modal) {
        modal.style.display = 'none';
    }
    if (!event) {
        const modal = document.getElementById('quadrantModal');
        if (modal) modal.style.display = 'none';
    }
}

// Export map functions
window.showQuadrantTooltip = showQuadrantTooltip;
window.hideQuadrantTooltip = hideQuadrantTooltip;
window.filterByQuadrant = filterByQuadrant;
window.getQuadrantStats = getQuadrantStats;
window.openQuadrantModal = openQuadrantModal;
window.closeQuadrantModal = closeQuadrantModal;

// ============================================
// INLINE INFO PANEL FUNCTIONS
// ============================================

// ============================================
// INLINE INFO PANEL FUNCTIONS (4-PANEL DETAILED)
// ============================================

const SIDE_GROUPS = {
    'B1': ['B1', 'B3'],
    'B3': ['B1', 'B3'],
    'B2': ['B2', 'B4'],
    'B4': ['B2', 'B4']
};

window.toggleQuadrantPanel = function (quadrant) {
    const panelId = `panel-${quadrant}`;
    const panel = document.getElementById(panelId);

    if (!panel) return;

    const isVisible = panel.style.display === 'flex';

    if (!isVisible) {
        // Enforce Single Active Panel per Side
        const group = SIDE_GROUPS[quadrant];
        if (group) {
            group.forEach(q => {
                if (q !== quadrant) closeSpecificPanel(q);
            });
        }

        updateQuadrantStats(quadrant);
        panel.style.display = 'flex';
    } else {
        panel.style.display = 'none';
    }
};

window.switchPanelTab = function (quadrant, tabName) {
    // 1. Update Buttons
    const btnInc = document.getElementById(`tab-btn-${quadrant}-inc`);
    const btnAct = document.getElementById(`tab-btn-${quadrant}-act`);

    if (btnInc && btnAct) {
        if (tabName === 'incidentes') {
            btnInc.classList.add('active');
            btnAct.classList.remove('active');
        } else {
            btnAct.classList.add('active');
            btnInc.classList.remove('active');
        }
    }

    // 2. Show Content
    const contentInc = document.getElementById(`tab-content-${quadrant}-incidentes`);
    const contentAct = document.getElementById(`tab-content-${quadrant}-acciones`);

    if (contentInc && contentAct) {
        if (tabName === 'incidentes') {
            contentInc.style.display = 'block';
            contentAct.style.display = 'none';
        } else {
            contentInc.style.display = 'none';
            contentAct.style.display = 'block';
        }
    }
};

window.closeSpecificPanel = function (quadrant) {
    const panelId = `panel-${quadrant}`;
    const panel = document.getElementById(panelId);
    if (panel) {
        panel.style.display = 'none';
    }
};

function updateQuadrantStats(quadrant) {
    let data = DataStore.filteredData;
    if ((!data || data.length === 0) && DataStore.rawData && DataStore.rawData.length > 0) {
        data = DataStore.rawData;
    }
    data = data || [];

    const quadrantData = data.filter(r => r.quadrant === quadrant);

    // 1. Basic Stats
    const undocumented = quadrantData.reduce((sum, r) => {
        const val = parseInt(r.undocumented);
        return sum + (isNaN(val) ? 0 : val);
    }, 0);

    const elInc = document.getElementById(`stat-incidents-${quadrant}`);
    const elUndoc = document.getElementById(`stat-undoc-${quadrant}`);

    if (elInc) elInc.textContent = quadrantData.length;
    if (elUndoc) elUndoc.textContent = undocumented;

    // 2. Detailed Stats (Top Types & Actions)
    renderDetailedStats(quadrant, quadrantData);
}

function renderDetailedStats(quadrant, data) {
    // Top Incident Types
    const typeCounts = {};
    data.forEach(r => {
        const type = r.Tipo || r.type || r['Tipo de Incidente'] || 'Otros';
        typeCounts[type] = (typeCounts[type] || 0) + 1;
    });

    const sortedTypes = Object.entries(typeCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5);

    const listIncidents = document.getElementById(`list-incidents-${quadrant}`);
    if (listIncidents) {
        listIncidents.innerHTML = sortedTypes.map(([type, count]) => {
            const pct = data.length > 0 ? Math.round((count / data.length) * 100) : 0;
            return `
                <div class="mini-stat-item">
                    <span>${type}</span>
                    <span>${count}</span>
                </div>
                <div class="stat-bar-bg">
                    <div class="stat-bar-fill" style="width: ${pct}%"></div>
                </div>
            `;
        }).join('');
    }

    // Top Actions
    const actionCounts = {};
    data.forEach(r => {
        const action = r.Accion || r.actions || r['Acciones Tomadas'] || 'Sin registro';
        actionCounts[action] = (actionCounts[action] || 0) + 1;
    });

    const sortedActions = Object.entries(actionCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3);

    const listActions = document.getElementById(`list-actions-${quadrant}`);
    if (listActions) {
        listActions.innerHTML = sortedActions.map(([action, count]) => `
            <div class="mini-stat-item" style="border-bottom: 1px solid rgba(255,255,255,0.05)">
                <span style="white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:160px;" title="${action}">
                    ${action}
                </span>
                <span style="color:#a0aec0; font-size:0.75rem">${count}</span>
            </div>
        `).join('');
    }
}

// Export new functions
window.toggleQuadrantPanel = toggleQuadrantPanel;
window.closeSpecificPanel = closeSpecificPanel;


// ============================================
// RESPONSIVE IMAGE MAP
// ============================================

// Original coordinates based on 800px wide image
const originalImageWidth = 800;
const originalCoords = {
    'B1': '50,50,400,50,400,280,200,350,50,280',
    'B2': '400,50,750,50,750,280,550,350,400,280',
    'B3': '50,280,200,350,400,450,200,550,50,450',
    'B4': '400,280,550,350,750,280,750,450,550,550,400,450'
};

// Resize image map coordinates based on actual image size
function resizeImageMap() {
    const img = document.getElementById('mapaCuadrantes');
    if (!img) return;

    const currentWidth = img.clientWidth;
    if (currentWidth === 0) return;

    const scale = currentWidth / originalImageWidth;

    const areas = document.querySelectorAll('#imageMap area');
    areas.forEach(area => {
        const quadrant = area.getAttribute('data-quadrant');
        if (quadrant && originalCoords[quadrant]) {
            const originalCoordList = originalCoords[quadrant].split(',').map(Number);
            const scaledCoords = originalCoordList.map(coord => Math.round(coord * scale));
            area.setAttribute('coords', scaledCoords.join(','));
        }
    });
}

// Initialize responsive map
function initResponsiveMap() {
    const img = document.getElementById('mapaCuadrantes');
    if (!img) return;

    if (img.complete) {
        resizeImageMap();
    } else {
        img.onload = resizeImageMap;
    }

    // Resize on window resize
    window.addEventListener('resize', resizeImageMap);
}

// Auto-init when DOM ready
setTimeout(initResponsiveMap, 500);

window.resizeImageMap = resizeImageMap;
window.initResponsiveMap = initResponsiveMap;

// ============================================
// API DATA REFRESH (Power BI Style)
// ============================================

/**
 * Refresh data from the appropriate source based on environment:
 * - GitHub Pages: loads from raw.githubusercontent.com/data.json
 * - Local development: loads from local API or data.json
 */
window.refreshDataFromAPI = async function () {
    const btn = document.getElementById('btnRefreshData');
    const originalHTML = btn.innerHTML;

    // Detect if we're on GitHub Pages
    const isGitHubPages = window.location.hostname.includes('github.io');
    const isLocalFile = window.location.protocol === 'file:';

    try {
        // Show loading state
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> <span>Cargando...</span>';
        btn.disabled = true;

        let data = null;
        let recordCount = 0;

        if (isGitHubPages) {
            // On GitHub Pages: load from raw GitHub data.json
            console.log('[Refresh] Cargando desde GitHub data.json...');
            const gitHubUrl = 'https://raw.githubusercontent.com/jesusx26x/dashboard-seguridad-cjb/main/data.json?' + Date.now();
            const response = await fetch(gitHubUrl);

            if (!response.ok) {
                throw new Error(`Error ${response.status}: No se pudo cargar data.json desde GitHub`);
            }

            const result = await response.json();
            data = result.data;
            recordCount = result.count || data.length;
            console.log(`[GitHub] Datos recibidos: ${recordCount} registros`);

        } else if (isLocalFile) {
            // Local file protocol: try to load local data.json
            console.log('[Refresh] Cargando desde data.json local...');
            const response = await fetch('data.json?' + Date.now());

            if (!response.ok) {
                throw new Error('No se pudo cargar data.json. Verifica que el archivo existe.');
            }

            const result = await response.json();
            data = result.data;
            recordCount = result.count || data.length;
            console.log(`[Local] Datos recibidos: ${recordCount} registros`);

        } else {
            // Localhost development: try API first, then fallback to data.json
            console.log('[Refresh] Intentando API local...');
            try {
                const response = await fetch('/api/incidentes');
                if (response.ok) {
                    const result = await response.json();
                    if (result.success) {
                        data = result.data;
                        recordCount = result.count || data.length;
                        console.log(`[API] Datos recibidos: ${recordCount} registros`);
                    }
                }
            } catch (apiError) {
                console.log('[API] No disponible, usando data.json local...');
            }

            // Fallback to local data.json if API failed
            if (!data) {
                const response = await fetch('data.json?' + Date.now());
                if (!response.ok) {
                    throw new Error('No se pudo cargar data.json ni conectar con la API.');
                }
                const result = await response.json();
                data = result.data;
                recordCount = result.count || data.length;
                console.log(`[Local Fallback] Datos recibidos: ${recordCount} registros`);
            }
        }

        if (!data || !Array.isArray(data)) {
            throw new Error('Formato de datos inválido');
        }

        // Transform API data to match expected format
        const transformedData = transformAPIData(data);

        // Load into DataStore
        DataStore.load(transformedData);

        // Update UI
        updateDataStatus(`${recordCount} registros cargados`, true);

        // Success feedback
        btn.innerHTML = '<i class="fas fa-check"></i> <span>¡Actualizado!</span>';
        btn.classList.add('btn-success');
        showToast(`${recordCount} registros cargados correctamente`, 'success');

        setTimeout(() => {
            btn.innerHTML = originalHTML;
            btn.classList.remove('btn-success');
            btn.disabled = false;
        }, 2000);

    } catch (error) {
        console.error('[Refresh] Error:', error);

        // Error feedback
        btn.innerHTML = '<i class="fas fa-exclamation-triangle"></i> <span>Error</span>';
        btn.classList.add('btn-error');

        // Show user-friendly error
        showToast(`Error: ${error.message}`, 'error');

        setTimeout(() => {
            btn.innerHTML = originalHTML;
            btn.classList.remove('btn-error');
            btn.disabled = false;
        }, 3000);
    }
};

/**
 * Transform API data (raw Excel) to match dashboard format
 * Column mappings based on actual Excel headers from Microsoft Forms
 */
function transformAPIData(apiData) {
    return apiData.map((row, index) => {
        // Parse date from "Hora de inicio" field (format: M/D/YY H:MM)
        const dateStr = row['Hora de inicio'] || '';
        let date = null;

        if (dateStr) {
            try {
                // Format: "8/25/25 15:22" -> M/D/YY H:MM
                const parts = dateStr.split(' ');
                if (parts.length >= 1) {
                    const dateParts = parts[0].split('/');
                    if (dateParts.length === 3) {
                        const month = parseInt(dateParts[0]) - 1;
                        const day = parseInt(dateParts[1]);
                        let year = parseInt(dateParts[2]);
                        // Handle 2-digit year
                        if (year < 100) {
                            year = year + 2000;
                        }
                        date = new Date(year, month, day);

                        // Add time if available
                        if (parts[1]) {
                            const timeParts = parts[1].split(':');
                            if (timeParts.length >= 2) {
                                date.setHours(parseInt(timeParts[0]) || 0);
                                date.setMinutes(parseInt(timeParts[1]) || 0);
                            }
                        }
                    }
                }
            } catch (e) {
                console.warn('Error parsing date:', dateStr, e);
            }
        }

        // Parse Cantidad de Indocumentados
        let undocCount = 0;
        const undocStr = row['Cantidad de Indocumentados detenidos'] || '';
        if (undocStr) {
            const parsed = parseInt(undocStr);
            if (!isNaN(parsed)) {
                undocCount = parsed;
            }
        } else {
            // If no explicit count, check if it's a migration incident with "Indocumentado"
            const migrationType = row['Incidentes de migración'] || '';
            if (migrationType.toLowerCase().includes('indocumentado')) {
                undocCount = 1; // At least 1 if marked as indocumentado
            }
        }

        return {
            id: row['Id'] || index + 1,
            date: date,
            type: row['Tipo de Incidente'] || 'Sin Clasificar',
            quadrant: row['Cuadrante donde sucedió el hecho'] || row['Cuadrante donde sucedio el hecho'] || 'B1',
            officer: row['Oficial a cargo1'] || row['Oficial a cargo'] || 'Sin Asignar',
            undocumented: undocCount,
            narrative: row['Narrativa del Incidente'] || '',
            actions: row['Acciones Tomadas'] || '',
            personName: row['Nombre Completo'] || row['Nombre'] || ''
        };
    }).filter(row => row.type || row.narrative); // Filter empty rows
}

function updateDataStatus(message, success = true) {
    const status = document.getElementById('dataStatus');
    if (status) {
        status.innerHTML = `
            <i class="fas ${success ? 'fa-check-circle' : 'fa-database'}"></i>
            <span>${message}</span>
        `;
        status.classList.toggle('status-success', success);
    }
}

// ============================================
// MOBILE RESPONSIVE FUNCTIONALITY
// ============================================

/**
 * Initialize mobile responsive features
 */
function initMobileFeatures() {
    const filterToggleBtn = document.getElementById('filterToggleBtn');
    const filtersBar = document.querySelector('.filters-bar');
    const menuToggle = document.querySelector('.menu-toggle');
    const sidebar = document.querySelector('.sidebar');
    const sidebarOverlay = document.getElementById('sidebarOverlay');

    // Check if we're on mobile
    const isMobile = () => window.innerWidth <= 768;

    // Filter Toggle Button
    if (filterToggleBtn && filtersBar) {
        // Filters are HIDDEN by default on mobile via CSS (display:none)
        // We toggle the 'show-mobile' class to SHOW them

        filterToggleBtn.addEventListener('click', () => {
            const isVisible = filtersBar.classList.toggle('show-mobile');
            filterToggleBtn.classList.toggle('active', isVisible);

            // Update button text
            const span = filterToggleBtn.querySelector('span');
            if (span) {
                span.textContent = isVisible ? 'Ocultar Filtros' : 'Mostrar Filtros';
            }
        });
    }

    // Mobile Sidebar Toggle
    if (menuToggle && sidebar) {
        menuToggle.addEventListener('click', () => {
            sidebar.classList.toggle('active');
            if (sidebarOverlay) {
                sidebarOverlay.classList.toggle('active');
            }
        });
    }

    // Sidebar Overlay - click to close
    if (sidebarOverlay) {
        sidebarOverlay.addEventListener('click', () => {
            sidebar.classList.remove('active');
            sidebarOverlay.classList.remove('active');
        });
    }

    // Close sidebar when clicking a nav item (mobile)
    const navItems = document.querySelectorAll('.nav-item');
    navItems.forEach(item => {
        item.addEventListener('click', () => {
            if (isMobile() && sidebar.classList.contains('active')) {
                sidebar.classList.remove('active');
                if (sidebarOverlay) {
                    sidebarOverlay.classList.remove('active');
                }
            }
        });
    });

    // Handle window resize
    let resizeTimeout;
    window.addEventListener('resize', () => {
        clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(() => {
            if (!isMobile()) {
                // On desktop: remove show-mobile class (CSS shows filters without it)
                if (filtersBar) {
                    filtersBar.classList.remove('show-mobile');
                }
                if (filterToggleBtn) {
                    filterToggleBtn.classList.remove('active');
                    const span = filterToggleBtn.querySelector('span');
                    if (span) span.textContent = 'Mostrar Filtros';
                }
                // Close mobile sidebar
                if (sidebar) {
                    sidebar.classList.remove('active');
                }
                if (sidebarOverlay) {
                    sidebarOverlay.classList.remove('active');
                }
            } else {
                // On mobile: hide filters (remove show-mobile class)
                if (filtersBar) {
                    filtersBar.classList.remove('show-mobile');
                }
                if (filterToggleBtn) {
                    filterToggleBtn.classList.remove('active');
                    const span = filterToggleBtn.querySelector('span');
                    if (span) span.textContent = 'Mostrar Filtros';
                }
            }
        }, 150);
    });

    console.log('[Mobile] Responsive features initialized');
}

// Initialize mobile features when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    // Small delay to ensure other initializations complete
    setTimeout(initMobileFeatures, 100);
});
