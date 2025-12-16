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
                    showToast('Primero cargue un archivo de datos', 'warning');
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
                    }
                },
                scales: {
                    x: { beginAtZero: true, grid: { color: 'rgba(0,0,0,0.05)' } },
                    y: { grid: { display: false } }
                }
            }
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
                    legend: { position: 'right' }
                },
                cutout: '60%'
            }
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
                plugins: { legend: { display: false } },
                scales: {
                    x: { beginAtZero: true, grid: { color: 'rgba(0,0,0,0.05)' } },
                    y: { grid: { display: false } }
                }
            }
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
                plugins: { legend: { display: false } },
                scales: {
                    x: { grid: { display: false } },
                    y: { beginAtZero: true, grid: { color: 'rgba(0,0,0,0.05)' } }
                }
            }
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

        // Simple visualization as grouped bar
        const hourLabels = Array.from({ length: 24 }, (_, i) => `${i}:00`);
        const datasets = days.map((day, dayIdx) => ({
            label: day,
            data: hourLabels.map((_, h) => heatData.find(d => d.x === h && d.y === dayIdx)?.v || 0),
            backgroundColor: this.generateColors(7, 0.7)[dayIdx]
        }));

        this.charts.heatmap = new Chart(ctx.getContext('2d'), {
            type: 'bar',
            data: { labels: hourLabels, datasets },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { position: 'top' } },
                scales: {
                    x: { stacked: true, grid: { display: false } },
                    y: { stacked: true, beginAtZero: true }
                }
            }
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
    document.getElementById('btnExportExcel').disabled = false;
    document.getElementById('btnExportPDF').disabled = false;
    document.getElementById('dataStatus').innerHTML = `<i class="fas fa-check-circle"></i><span>${DataStore.rawData.length} registros</span>`;
    document.getElementById('dataStatus').classList.add('loaded');

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
    showToast('Generando PDF...', 'info', 3000);
    showLoading(true);
    html2pdf().set({
        margin: 10, filename: `Dashboard_CJB_${new Date().toISOString().slice(0, 10)}.pdf`,
        image: { type: 'jpeg', quality: 0.95 },
        html2canvas: { scale: 2 },
        jsPDF: { format: 'a4', orientation: 'landscape' }
    }).from(document.getElementById('dashboardPage')).save().then(() => {
        showLoading(false);
        showToast('PDF descargado', 'success');
    });
}

function generateExecutiveSummary() {
    const agg = DataStore.getAggregations();
    const modal = document.getElementById('summaryModal');
    document.getElementById('summaryModalBody').innerHTML = `
        <div class="summary-content">
            <h2>Resumen Ejecutivo - Dashboard de Seguridad CJB</h2>
            <p><strong>Fecha:</strong> ${new Date().toLocaleDateString('es-DO')}</p>
            <p><strong>Periodo:</strong> ${document.getElementById('filterDateFrom')?.value || 'N/A'} - ${document.getElementById('filterDateTo')?.value || 'N/A'}</p>
            <hr>
            <h3>📊 Métricas Principales</h3>
            <ul>
                <li><strong>Total Incidentes:</strong> ${agg.total}</li>
                <li><strong>Indocumentados Detenidos:</strong> ${agg.undocumented}</li>
                <li><strong>Accidentes de Tránsito:</strong> ${agg.accidents}</li>
                <li><strong>Arrestos Realizados:</strong> ${agg.arrests}</li>
                <li><strong>Oficiales Activos:</strong> ${agg.officers}</li>
                <li><strong>Clausuras:</strong> ${agg.closures}</li>
            </ul>
            <h3>📈 Distribución por Tipo</h3>
            <ul>${DataStore.groupBy('type').slice(0, 5).map(([t, c]) => `<li>${t}: ${c}</li>`).join('')}</ul>
            <h3>🗺️ Distribución por Cuadrante</h3>
            <ul>${DataStore.groupBy('quadrant').filter(([q]) => q !== 'No especificado').slice(0, 5).map(([q, c]) => `<li>${q}: ${c}</li>`).join('')}</ul>
        </div>
    `;
    modal.classList.add('active');
}

function closeSummaryModal() { document.getElementById('summaryModal')?.classList.remove('active'); }
function printSummary() { window.print(); }

// Función para imprimir reporte individual de incidente con formato oficial CJB
function printIncidentReport(id) {
    const incident = DataStore.rawData.find(r => r.id == id);
    if (!incident) { showToast('Incidente no encontrado', 'error'); return; }

    const reportDate = formatDisplayDate(incident.date, true);
    const today = new Date().toLocaleDateString('es-DO', { day: '2-digit', month: 'long', year: 'numeric' });

    // Crear ventana de impresión con formato oficial
    const printWindow = window.open('', '_blank', 'width=800,height=600');
    printWindow.document.write(`
        <!DOCTYPE html>
        <html lang="es">
        <head>
            <meta charset="UTF-8">
            <title>Informe de Incidente #${incident.id} - Seguridad CJB</title>
            <style>
                * { margin: 0; padding: 0; box-sizing: border-box; }
                body { 
                    font-family: 'Arial', sans-serif; 
                    padding: 30px; 
                    color: #333;
                    line-height: 1.6;
                }
                .header { 
                    text-align: center; 
                    border-bottom: 3px solid #1E3A5F;
                    padding-bottom: 20px;
                    margin-bottom: 30px;
                }
                .header h1 { 
                    color: #1E3A5F; 
                    font-size: 1.8rem;
                    margin-bottom: 5px;
                }
                .header h2 { 
                    color: #2ECC71;
                    font-size: 1.2rem;
                    font-weight: normal;
                }
                .header .subtitle {
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
                }
                .section-title {
                    background: #f5f5f5;
                    padding: 8px 15px;
                    border-left: 4px solid #2ECC71;
                    font-weight: bold;
                    color: #1E3A5F;
                    margin-bottom: 15px;
                }
                .narrative-box {
                    border: 1px solid #ddd;
                    padding: 15px;
                    border-radius: 5px;
                    background: #fafafa;
                    min-height: 100px;
                }
                .footer {
                    margin-top: 40px;
                    padding-top: 20px;
                    border-top: 2px solid #1E3A5F;
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: 30px;
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
                    body { padding: 20px; }
                    .no-print { display: none; }
                }
            </style>
        </head>
        <body>
            <div class="header">
                <h1>DIRECCIÓN DE SEGURIDAD</h1>
                <h2>Ciudad Juan Bosch</h2>
                <p class="subtitle">Santo Domingo Este, República Dominicana</p>
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
                <div class="narrative-box">
                    ${escapeHtml(incident.narrative) || 'Sin narrativa registrada.'}
                </div>
            </div>
            
            ${incident.evidence ? `
            <div class="section">
                <div class="section-title">EVIDENCIA VISUAL</div>
                <p>Disponible en: <a href="${escapeHtml(incident.evidence)}">${escapeHtml(incident.evidence)}</a></p>
            </div>
            ` : ''}
            
            <div class="footer">
                <div class="signature-box">
                    <span class="signature-label">Firma del Oficial</span>
                </div>
                <div class="signature-box">
                    <span class="signature-label">Firma del Supervisor</span>
                </div>
            </div>
            
            <p class="print-date">Documento generado el ${today}</p>
            
            <script>
                window.onload = function() { window.print(); }
            </script>
        </body>
        </html>
    `);
    printWindow.document.close();
}

// ============================================
// INITIALIZATION
// ============================================
document.addEventListener('DOMContentLoaded', () => {
    UIManager.init();
    ChartManager.init();
    Navigation.init();
    TableManager.init();
    FileParser.init();
    console.log('Dashboard CJB v3.0 - Power BI Edition cargado');
});

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
