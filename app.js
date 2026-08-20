const SUPABASE_URL = 'https://egtuebbuugvmtpadupgj.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVndHVlYmJ1dWd2bXRwYWR1cGdqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ1Nzg0MTEsImV4cCI6MjEwMDE1NDQxMX0.96Zq53ezM1chWa1yEBMs6m2bom9mCJsORSpF-olH-V0';
let supabaseClient = null;
if (typeof supabase !== 'undefined' && SUPABASE_KEY.trim() !== '') {
    supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
}
const AppState = {
    activePage: localStorage.getItem('khalila_active_page') || 'dashboard-wsa', 
    activeRegion: localStorage.getItem('khalila_active_region') || 'eastern',
    activeYear: localStorage.getItem('khalila_active_year') || '2026',
    activeMonth: localStorage.getItem('khalila_active_month') || 'Juli',
    selectedSingleKpi: localStorage.getItem('khalila_selected_kpi') || 'serviceAvailability',
    selectedSto: 'ALL',
    singleKpiSort: 'default',
    customData: {},
    stoLists: {
        bogor: [
            "BGL", "BJD", "BOO", "CAU", "CBD", "CBI", "CCR", "CGD", "CJU", "CKB", "CLS", "CMO", "CPS", "CRI", "CSE", "CSN", "CSR", "CTR", "CWI", "CYI", "DMG", "GPI", "JGL",
            "JPK", "JSA", "KHL", "KLU", "LBI", "LWL", "NLD", "PAG", "PAR", "PLR",
            "PMU", "PPG", "RMP", "SGN", "SKB", "SPL", "STL", "TJH", "TJO"
        ],
        bekasi: [
            "BEK", "CBB", "CNE", "CSL", "DEP", "KLB", "KRA", "PCM", "PDE", "PKY", "SKJ"
        ],
        karawang: [
            "BBL", "BGG", "CBG", "CBR", "CBU", "CIB", "CIK", "CKP", "CLM", "CPL",
            "DNI", "EJI", "JBB", "JTS", "KLI", "KRL", "KRW", "LMA", "MGB", "PBY",
            "PLD", "PWK", "RDK", "SMH", "STN", "SUE", "TAR", "TBL", "TLJ", "WDS"
        ]
    }
};
const MONTHS_LIST = [
    "Januari", "Februari", "Maret", "April", "Mei", "Juni",
    "Juli", "Agustus", "September", "Oktober", "November", "Desember"
];
const KPI_LABEL_MAP = {
    serviceAvailability: { label: 'Service Availability (%)', icon: 'activity' },
    assuranceGuarantee: { label: 'Assurance Guarantee (%)', icon: 'shield-check' },
    ttr3h: { label: 'TTR 3H D,V', icon: 'clock' },
    ttr6h: { label: 'TTR 6H P', icon: 'hourglass' },
    ttr36h: { label: 'TTR 36H NON HVC', icon: 'users' },
    ttrManja: { label: 'TTR 3H MANJA', icon: 'heart-handshake' }
};
function formatPct(val) {
    if (val === undefined || val === null || isNaN(val)) return '0%';
    const num = parseFloat(val);
    if (Number.isInteger(num)) return `${num}%`;
    return `${num.toFixed(2)}%`;
}
function seededRandom(seed) {
    let h = 0;
    for (let i = 0; i < seed.length; i++) {
        h = seed.charCodeAt(i) + ((h << 5) - h);
    }
    return function () {
        let x = Math.sin(h++) * 10000;
        return x - Math.floor(x);
    };
}
function generateEmptyData(region, month, year = '2026') {
    const stos = AppState.stoLists[region] || [];
    return stos.map((sto) => {
        return {
            sto: sto.toUpperCase(),
            serviceAvailability: 0, serviceAvailabilityTotal: 0, serviceAvailabilityAchieved: 0,
            assuranceGuarantee: 0, assuranceGuaranteeTotal: 0, assuranceGuaranteeAchieved: 0,
            ttr3h: 0, ttr3hTotal: 0, ttr3hAchieved: 0,
            ttr6h: 0, ttr6hTotal: 0, ttr6hAchieved: 0,
            ttr36h: 0, ttr36hTotal: 0, ttr36hAchieved: 0,
            ttrManja: 0, ttrManjaTotal: 0, ttrManjaAchieved: 0
        };
    });
}
function mapDbRowToAppObj(r) {
    if (!r) return null;
    if (r.serviceAvailability !== undefined && r.assuranceGuarantee !== undefined && r.ttr3h !== undefined) {
        return { ...r };
    }
    const stoUpper = String(r.sto || '').toUpperCase().trim();
    const mapCategory = (pctVal, totalVal, achieveVal) => {
        let pct = parseFloat(pctVal);
        if (isNaN(pct)) pct = 0;
        pct = Math.min(100, Math.max(0, Math.round(pct * 100) / 100));
        let total = parseInt(totalVal, 10);
        if (isNaN(total) || total <= 0) total = 100;
        let achieved = parseInt(achieveVal, 10);
        if (isNaN(achieved)) achieved = Math.round((pct / 100) * total);
        achieved = Math.min(total, Math.max(0, achieved));
        return { pct, total, achieved };
    };
    const sa = mapCategory(
        r.service_availability !== undefined ? r.service_availability : r.serviceAvailability,
        r.service_availability_total !== undefined ? r.service_availability_total : r.serviceAvailabilityTotal,
        r.service_availability_achieved !== undefined ? r.service_availability_achieved : r.serviceAvailabilityAchieved
    );
    const ag = mapCategory(
        r.assurance_guarantee !== undefined ? r.assurance_guarantee : r.assuranceGuarantee,
        r.assurance_guarantee_total !== undefined ? r.assurance_guarantee_total : r.assuranceGuaranteeTotal,
        r.assurance_guarantee_achieved !== undefined ? r.assurance_guarantee_achieved : r.assuranceGuaranteeAchieved
    );
    const t3 = mapCategory(
        r.ttr_3h !== undefined ? r.ttr_3h : r.ttr3h,
        r.ttr_3h_total !== undefined ? r.ttr_3h_total : r.ttr3hTotal,
        r.ttr_3h_achieved !== undefined ? r.ttr_3h_achieved : r.ttr3hAchieved
    );
    const t6 = mapCategory(
        r.ttr_6h !== undefined ? r.ttr_6h : r.ttr6h,
        r.ttr_6h_total !== undefined ? r.ttr_6h_total : r.ttr6hTotal,
        r.ttr_6h_achieved !== undefined ? r.ttr_6h_achieved : r.ttr6hAchieved
    );
    const t36 = mapCategory(
        r.ttr_36h !== undefined ? r.ttr_36h : r.ttr36h,
        r.ttr_36h_total !== undefined ? r.ttr_36h_total : r.ttr36hTotal,
        r.ttr_36h_achieved !== undefined ? r.ttr_36h_achieved : r.ttr36hAchieved
    );
    const manja = mapCategory(
        r.ttr_3h_manja !== undefined ? r.ttr_3h_manja : r.ttrManja,
        r.ttr_3h_manja_total !== undefined ? r.ttr_3h_manja_total : r.ttrManjaTotal,
        r.ttr_3h_manja_achieved !== undefined ? r.ttr_3h_manja_achieved : r.ttrManjaAchieved
    );
    return {
        sto: stoUpper,
        serviceAvailability: sa.pct, serviceAvailabilityTotal: sa.total, serviceAvailabilityAchieved: sa.achieved,
        serviceAvailabilityExcelAch: r.service_availability_excel_ach, serviceAvailabilityExcelNotAch: r.service_availability_excel_not_ach,
        assuranceGuarantee: ag.pct, assuranceGuaranteeTotal: ag.total, assuranceGuaranteeAchieved: ag.achieved,
        assuranceGuaranteeExcelAch: r.assurance_guarantee_excel_ach, assuranceGuaranteeExcelNotAch: r.assurance_guarantee_excel_not_ach,
        ttr3h: t3.pct, ttr3hTotal: t3.total, ttr3hAchieved: t3.achieved,
        ttr3hExcelAch: r.ttr_3h_excel_ach, ttr3hExcelNotAch: r.ttr_3h_excel_not_ach,
        ttr6h: t6.pct, ttr6hTotal: t6.total, ttr6hAchieved: t6.achieved,
        ttr6hExcelAch: r.ttr_6h_excel_ach, ttr6hExcelNotAch: r.ttr_6h_excel_not_ach,
        ttr36h: t36.pct, ttr36hTotal: t36.total, ttr36hAchieved: t36.achieved,
        ttr36hExcelAch: r.ttr_36h_excel_ach, ttr36hExcelNotAch: r.ttr_36h_excel_not_ach,
        ttrManja: manja.pct, ttrManjaTotal: manja.total, ttrManjaAchieved: manja.achieved,
        ttrManjaExcelAch: r.ttr_3h_manja_excel_ach, ttrManjaExcelNotAch: r.ttr_3h_manja_excel_not_ach
    };
}
async function getActiveData(region, month, year = '2026') {
    const dataKey = `${region}_${year}_${month}`;
    const legacyKey = `${region}_${month}`;
    const localGroup = AppState.customData[dataKey] || AppState.customData[legacyKey];
    if (localGroup && localGroup.length > 0) {
        const stoList = AppState.stoLists[region] || [];
        const existingMap = {};
        localGroup.forEach(item => {
            if (item && item.sto) {
                existingMap[item.sto.toUpperCase()] = item;
            }
        });
        return stoList.map(stoName => {
            const upper = stoName.toUpperCase();
            if (existingMap[upper]) {
                return existingMap[upper];
            }
            return {
                sto: upper,
                serviceAvailability: 0, serviceAvailabilityTotal: 0, serviceAvailabilityAchieved: 0,
                assuranceGuarantee: 0, assuranceGuaranteeTotal: 0, assuranceGuaranteeAchieved: 0,
                ttr3h: 0, ttr3hTotal: 0, ttr3hAchieved: 0,
                ttr6h: 0, ttr6hTotal: 0, ttr6hAchieved: 0,
                ttr36h: 0, ttr36hTotal: 0, ttr36hAchieved: 0,
                ttrManja: 0, ttrManjaTotal: 0, ttrManjaAchieved: 0
            };
        });
    }
    let rawData = [];
    if (supabaseClient) {
        try {
            const { data, error } = await supabaseClient
                .from('sto_performance')
                .select('*')
                .eq('region', region)
                .eq('year', year)
                .eq('month', month);
            if (!error && data && data.length > 0) {
                rawData = data.map(mapDbRowToAppObj);
                AppState.customData[dataKey] = rawData;
            }
        } catch (e) {
            console.error("Supabase load error:", e);
        }
    }
    if (rawData.length > 0) {
        const stoList = AppState.stoLists[region] || [];
        const existingMap = {};
        rawData.forEach(item => {
            if (item && item.sto) {
                existingMap[item.sto.toUpperCase()] = item;
            }
        });
        return stoList.map(stoName => {
            const upper = stoName.toUpperCase();
            if (existingMap[upper]) {
                return existingMap[upper];
            }
            return {
                sto: upper,
                serviceAvailability: 0, serviceAvailabilityTotal: 0, serviceAvailabilityAchieved: 0,
                assuranceGuarantee: 0, assuranceGuaranteeTotal: 0, assuranceGuaranteeAchieved: 0,
                ttr3h: 0, ttr3hTotal: 0, ttr3hAchieved: 0,
                ttr6h: 0, ttr6hTotal: 0, ttr6hAchieved: 0,
                ttr36h: 0, ttr36hTotal: 0, ttr36hAchieved: 0,
                ttrManja: 0, ttrManjaTotal: 0, ttrManjaAchieved: 0
            };
        });
    }
    rawData = generateEmptyData(region, month, year);
    AppState.customData[dataKey] = rawData;
    return rawData;
}
async function getExistingGroupData(targetKey) {
    const [reg, mon, wk] = targetKey.split('_');
    const existingMap = {};
    if (supabaseClient) {
        try {
            const { data, error } = await supabaseClient
                .from('sto_performance')
                .select('*')
                .eq('region', reg)
                .eq('month', mon)
                .eq('week', wk);
            if (!error && data && data.length > 0) {
                data.forEach(r => {
                    const obj = mapDbRowToAppObj(r);
                    existingMap[obj.sto] = obj;
                });
                return existingMap;
            }
        } catch (e) {
            console.error("Error fetching existing data group:", e);
        }
    }
    if (AppState.customData[targetKey] && AppState.customData[targetKey].length > 0) {
        AppState.customData[targetKey].forEach(r => {
            const obj = mapDbRowToAppObj(r);
            existingMap[obj.sto] = obj;
        });
    }
    return existingMap;
}
function saveToLocalStorage() {
    try {
        localStorage.setItem('sto_dashboard_custom_data', JSON.stringify(AppState.customData));
        localStorage.setItem('khalila_active_page', AppState.activePage || 'dashboard-wsa');
        localStorage.setItem('khalila_active_region', AppState.activeRegion || 'bekasi');
        localStorage.setItem('khalila_active_year', AppState.activeYear || '2026');
        localStorage.setItem('khalila_active_month', AppState.activeMonth || 'Juli');
        localStorage.setItem('khalila_selected_kpi', AppState.selectedSingleKpi || 'serviceAvailability');
    } catch (e) {
        console.error("Failed to save state to localStorage: ", e);
    }
}
function loadFromLocalStorage() {
    try {
        const savedPage = localStorage.getItem('khalila_active_page');
        if (savedPage) AppState.activePage = savedPage;
        const savedRegion = localStorage.getItem('khalila_active_region');
        if (savedRegion) AppState.activeRegion = savedRegion;
        const savedYear = localStorage.getItem('khalila_active_year');
        if (savedYear) AppState.activeYear = savedYear;
        const savedMonth = localStorage.getItem('khalila_active_month');
        if (savedMonth) AppState.activeMonth = savedMonth;
        const savedKpi = localStorage.getItem('khalila_selected_kpi');
        if (savedKpi) AppState.selectedSingleKpi = savedKpi;
        const saved = localStorage.getItem('sto_dashboard_custom_data');
        if (saved) {
            const parsed = JSON.parse(saved);
            let isDummy = false;
            for (const list of Object.values(parsed)) {
                if (Array.isArray(list) && list.some(item => item.serviceAvailability > 0 && item.serviceAvailabilityTotal === 10)) {
                    isDummy = true;
                    break;
                }
            }
            if (isDummy) {
                localStorage.removeItem('sto_dashboard_custom_data');
                AppState.customData = {};
            } else {
                AppState.customData = parsed;
            }
        }
    } catch (e) {
        console.error("Failed to parse localstorage data: ", e);
    }
}
function showToast(message, type = 'success') {
    const container = document.getElementById('toast-container');
    if (!container) return;
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    const iconName = type === 'success' ? 'check-circle' : 'alert-circle';
    toast.innerHTML = `
        <i data-lucide="${iconName}"></i>
        <span>${message}</span>
    `;
    container.appendChild(toast);
    lucide.createIcons();
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(15px)';
        toast.style.transition = 'all 0.3s ease';
        setTimeout(() => toast.remove(), 300);
    }, 4000);
}
async function renderAllKpiTable() {
    const region = AppState.activeRegion;
    const month = AppState.activeMonth;
    const year = AppState.activeYear || '2026';
    const tbody = document.getElementById('table-body');
    const tfoot = document.getElementById('table-footer');
    const thead = document.querySelector('#performance-table thead');
    thead.innerHTML = `
        <tr>
            <th style="width: 50px; text-align: center;"><div class="th-content">No.</div></th>
            <th class="sticky-col">
                <div class="th-content"><i data-lucide="building"></i> ${region === 'eastern' ? 'Branch' : 'STO'}</div>
            </th>
            <th><div class="th-content"><i data-lucide="activity"></i> Service Availability (%)</div></th>
            <th><div class="th-content"><i data-lucide="shield-check"></i> Assurance Guarantee (%)</div></th>
            <th><div class="th-content"><i data-lucide="clock"></i> TTR 3H D,V</div></th>
            <th><div class="th-content"><i data-lucide="hourglass"></i> TTR 6H P</div></th>
            <th><div class="th-content"><i data-lucide="users"></i> TTR 36H NON HVC</div></th>
            <th><div class="th-content"><i data-lucide="heart-handshake"></i> TTR 3H MANJA</div></th>
        </tr>
    `;
    tbody.innerHTML = '<tr><td colspan="8" style="text-align: center; padding: 20px; font-weight: 500; color: var(--text-secondary);">Memuat data...</td></tr>';
    tfoot.innerHTML = '';
    async function getEasternAggregatedData(m, y) {
        const branches = ['bekasi', 'bogor', 'karawang'];
        const branchRows = [];
        for (const b of branches) {
            const rawData = await getActiveData(b, m, y);
            let sumSaPct = 0, countSa = 0, sumSaAch = 0, sumSaNot = 0;
            let sumAgPct = 0, countAg = 0, sumAgAch = 0, sumAgNot = 0;
            let sumT3Pct = 0, countT3 = 0, sumT3Ach = 0, sumT3Not = 0;
            let sumT6Pct = 0, countT6 = 0, sumT6Ach = 0, sumT6Not = 0;
            let sumT36Pct = 0, countT36 = 0, sumT36Ach = 0, sumT36Not = 0;
            let sumManjaPct = 0, countManja = 0, sumManjaAch = 0, sumManjaNot = 0;
            let hasAnyData = false;
            rawData.forEach(r => {
                const getAch = (pct, targetSla, eAch, eNot) => {
                    const hasPct = pct !== undefined && pct > 0;
                    if (!hasPct && !r.hasData) return { ach: 0, not: 0 };
                    const ach = eAch !== undefined ? eAch : (pct >= targetSla ? 1 : 0);
                    const not = eNot !== undefined ? eNot : (pct >= targetSla ? 0 : 1);
                    return { ach, not };
                };
                if (r.serviceAvailability > 0 || r.hasData) { sumSaPct += r.serviceAvailability; countSa++; hasAnyData = true; const c = getAch(r.serviceAvailability, 98.52, r.serviceAvailabilityExcelAch, r.serviceAvailabilityExcelNotAch); sumSaAch += c.ach; sumSaNot += c.not; }
                if (r.assuranceGuarantee > 0 || r.hasData) { sumAgPct += r.assuranceGuarantee; countAg++; hasAnyData = true; const c = getAch(r.assuranceGuarantee, 91.71, r.assuranceGuaranteeExcelAch, r.assuranceGuaranteeExcelNotAch); sumAgAch += c.ach; sumAgNot += c.not; }
                if (r.ttr3h > 0 || r.hasData) { sumT3Pct += r.ttr3h; countT3++; hasAnyData = true; const c = getAch(r.ttr3h, 92.25, r.ttr3hExcelAch, r.ttr3hExcelNotAch); sumT3Ach += c.ach; sumT3Not += c.not; }
                if (r.ttr6h > 0 || r.hasData) { sumT6Pct += r.ttr6h; countT6++; hasAnyData = true; const c = getAch(r.ttr6h, 95.0, r.ttr6hExcelAch, r.ttr6hExcelNotAch); sumT6Ach += c.ach; sumT6Not += c.not; }
                if (r.ttr36h > 0 || r.hasData) { sumT36Pct += r.ttr36h; countT36++; hasAnyData = true; const c = getAch(r.ttr36h, 99.04, r.ttr36hExcelAch, r.ttr36hExcelNotAch); sumT36Ach += c.ach; sumT36Not += c.not; }
                if (r.ttrManja > 0 || r.hasData) { sumManjaPct += r.ttrManja; countManja++; hasAnyData = true; const c = getAch(r.ttrManja, 94.69, r.ttrManjaExcelAch, r.ttrManjaExcelNotAch); sumManjaAch += c.ach; sumManjaNot += c.not; }
            });
            branchRows.push({
                sto: b.toUpperCase(), hasData: hasAnyData,
                serviceAvailability: countSa > 0 ? (sumSaPct / countSa) : 0, serviceAvailabilityExcelAch: sumSaAch, serviceAvailabilityExcelNotAch: sumSaNot,
                assuranceGuarantee: countAg > 0 ? (sumAgPct / countAg) : 0, assuranceGuaranteeExcelAch: sumAgAch, assuranceGuaranteeExcelNotAch: sumAgNot,
                ttr3h: countT3 > 0 ? (sumT3Pct / countT3) : 0, ttr3hExcelAch: sumT3Ach, ttr3hExcelNotAch: sumT3Not,
                ttr6h: countT6 > 0 ? (sumT6Pct / countT6) : 0, ttr6hExcelAch: sumT6Ach, ttr6hExcelNotAch: sumT6Not,
                ttr36h: countT36 > 0 ? (sumT36Pct / countT36) : 0, ttr36hExcelAch: sumT36Ach, ttr36hExcelNotAch: sumT36Not,
                ttrManja: countManja > 0 ? (sumManjaPct / countManja) : 0, ttrManjaExcelAch: sumManjaAch, ttrManjaExcelNotAch: sumManjaNot
            });
        }
        return branchRows;
    }
    const isEastern = region === 'eastern';
    const monthData = isEastern ? await getEasternAggregatedData(month, year) : await getActiveData(region, month, year);
    tbody.innerHTML = '';
    let stoList = [];
    if (isEastern) {
        stoList = ['BEKASI', 'BOGOR', 'KARAWANG'];
    } else if (AppState.selectedSto && AppState.selectedSto !== 'ALL') {
        stoList = [AppState.selectedSto];
    } else {
        const extraStos = new Set(AppState.stoLists[region] || []);
        if (Array.isArray(monthData)) {
            monthData.forEach(d => {
                if (d && d.sto && d.hasData) extraStos.add(d.sto.toUpperCase());
            });
        }
        stoList = Array.from(extraStos);
    }
    if (stoList.length === 0) {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td colspan="7" style="text-align: center; padding: 40px; color: var(--text-secondary); line-height: 1.6;">
                <i data-lucide="folder-open" style="width: 32px; height: 32px; color: var(--red-primary); margin-bottom: 8px; display: inline-block;"></i>
                <h4 style="font-size: 15px; font-weight: 700; color: var(--navy-dark); margin-bottom: 4px;">Belum ada Data</h4>
                <p style="font-size: 12.5px;">Belum ada data di periode ini, mohon upload file excel Anda.</p>
            </td>
        `;
        tbody.appendChild(tr);
        lucide.createIcons();
        return;
    }
    let sumSaPct = 0, countSa = 0;
    let sumAgPct = 0, countAg = 0;
    let sumT3Pct = 0, countT3 = 0;
    let sumT6Pct = 0, countT6 = 0;
    let sumT36Pct = 0, countT36 = 0;
    let sumManjaPct = 0, countManja = 0;
    stoList.forEach((stoName, index) => {
        const row = (monthData || []).find(d => d.sto.toUpperCase() === stoName.toUpperCase()) || {};
        const renderMetricCell = (pct, targetSla, categoryName, excelAch, excelNotAch) => {
            const hasData = pct !== undefined && pct !== null && pct > 0;
            if (!hasData) {
                return `
                    <div class="metric-cell-card" style="justify-content: center; align-items: center;">
                        <span style="color: var(--text-secondary); opacity: 0.4; font-weight: 500;">-</span>
                    </div>
                `;
            }
            const isAchieved = pct >= targetSla;
            let achCount = (excelAch !== undefined && excelAch !== null) ? excelAch : (isAchieved ? 1 : 0);
            let notAchCount = (excelNotAch !== undefined && excelNotAch !== null) ? excelNotAch : (isAchieved ? 0 : 1);
            return `
                <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 4px;">
                    <div style="font-weight: 700; font-size: 14px; color: ${!isAchieved ? '#dc2626' : 'var(--navy-dark)'};">
                        ${formatPct(pct)}
                    </div>
                    <div style="display: flex; align-items: center; gap: 8px; font-size: 11.5px;">
                        <div style="display: flex; align-items: center; gap: 3px; color: #059669; font-weight: 600;">
                            <i data-lucide="check-circle" style="width: 12px; height: 12px;"></i><span>${achCount}</span>
                        </div>
                        <div style="display: flex; align-items: center; gap: 3px; color: ${notAchCount > 0 ? '#dc2626' : '#94a3b8'}; font-weight: ${notAchCount > 0 ? '600' : 'normal'};">
                            <i data-lucide="alert-circle" style="width: 12px; height: 12px;"></i><span>${notAchCount}</span>
                        </div>
                    </div>
                </div>
            `;
        };
        if (row.serviceAvailability > 0) { sumSaPct += row.serviceAvailability; countSa++; }
        if (row.assuranceGuarantee > 0) { sumAgPct += row.assuranceGuarantee; countAg++; }
        if (row.ttr3h > 0) { sumT3Pct += row.ttr3h; countT3++; }
        if (row.ttr6h > 0) { sumT6Pct += row.ttr6h; countT6++; }
        if (row.ttr36h > 0) { sumT36Pct += row.ttr36h; countT36++; }
        if (row.ttrManja > 0) { sumManjaPct += row.ttrManja; countManja++; }
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td style="text-align: center; font-weight: 600;">${index + 1}</td>
            <td class="sticky-col">${stoName}</td>
            <td>${renderMetricCell(row.serviceAvailability, 98.52, 'Service Availability (%)', row.serviceAvailabilityExcelAch, row.serviceAvailabilityExcelNotAch)}</td>
            <td>${renderMetricCell(row.assuranceGuarantee, 91.71, 'Assurance Guarantee (%)', row.assuranceGuaranteeExcelAch, row.assuranceGuaranteeExcelNotAch)}</td>
            <td>${renderMetricCell(row.ttr3h, 92.25, 'TTR 3H D,V', row.ttr3hExcelAch, row.ttr3hExcelNotAch)}</td>
            <td>${renderMetricCell(row.ttr6h, 95.0, 'TTR 6H P', row.ttr6hExcelAch, row.ttr6hExcelNotAch)}</td>
            <td>${renderMetricCell(row.ttr36h, 99.04, 'TTR 36H NON HVC', row.ttr36hExcelAch, row.ttr36hExcelNotAch)}</td>
            <td>${renderMetricCell(row.ttrManja, 94.69, 'TTR 3H MANJA', row.ttrManjaExcelAch, row.ttrManjaExcelNotAch)}</td>
        `;
        tbody.appendChild(tr);
    });
    const branchName = region === 'eastern' ? 'EASTERN' : region.toUpperCase();
    tfoot.innerHTML = `
        <tr>
            <td></td>
            <td class="sticky-col">${branchName}</td>
            <td style="font-weight: 700; text-align: center;">${countSa > 0 ? formatPct(sumSaPct / countSa) : '-'}</td>
            <td style="font-weight: 700; text-align: center;">${countAg > 0 ? formatPct(sumAgPct / countAg) : '-'}</td>
            <td style="font-weight: 700; text-align: center;">${countT3 > 0 ? formatPct(sumT3Pct / countT3) : '-'}</td>
            <td style="font-weight: 700; text-align: center;">${countT6 > 0 ? formatPct(sumT6Pct / countT6) : '-'}</td>
            <td style="font-weight: 700; text-align: center;">${countT36 > 0 ? formatPct(sumT36Pct / countT36) : '-'}</td>
            <td style="font-weight: 700; text-align: center;">${countManja > 0 ? formatPct(sumManjaPct / countManja) : '-'}</td>
        </tr>
    `;
    lucide.createIcons();
}
function updateStoFilterDropdown() {
    const stoSelect = document.getElementById('sto-filter-select');
    if (!stoSelect) return;
    if (AppState.activeRegion === 'eastern') {
        stoSelect.innerHTML = `<option value="ALL">Semua Branch</option>`;
        stoSelect.value = 'ALL';
        AppState.selectedSto = 'ALL';
        return;
    }
    const currentVal = AppState.selectedSto || 'ALL';
    const stos = AppState.stoLists[AppState.activeRegion] || [];
    stoSelect.innerHTML = `<option value="ALL">Semua STO</option>` + stos.map(sto => `
        <option value="${sto}">${sto}</option>
    `).join('');
    if (currentVal === 'ALL' || stos.includes(currentVal)) {
        stoSelect.value = currentVal;
    } else {
        stoSelect.value = 'ALL';
        AppState.selectedSto = 'ALL';
    }
}
async function renderSingleKpiTable() {
    const region = AppState.activeRegion;
    const year = AppState.activeYear || '2026';
    const selectedKpiKey = AppState.selectedSingleKpi || 'serviceAvailability';
    const kpiInfo = KPI_LABEL_MAP[selectedKpiKey] || KPI_LABEL_MAP.serviceAvailability;
    const targetSlaMap = {
        serviceAvailability: 98.52,
        assuranceGuarantee: 91.71,
        ttr3h: 92.25,
        ttr6h: 95.0,
        ttr36h: 99.04,
        ttrManja: 94.69
    };
    const targetSla = targetSlaMap[selectedKpiKey] || 98.52;
    const tbody = document.getElementById('table-body');
    const tfoot = document.getElementById('table-footer');
    const thead = document.querySelector('#performance-table thead');
    thead.innerHTML = `
        <tr>
            <th style="width: 50px; text-align: center;"><div class="th-content">No.</div></th>
            <th class="sticky-col">
                <div class="th-content"><i data-lucide="building"></i> ${region === 'eastern' ? 'Branch' : 'STO'}</div>
            </th>
            ${MONTHS_LIST.map(m => `
                <th><div class="th-content"><i data-lucide="calendar"></i> ${m.substring(0, 3)}</div></th>
            `).join('')}
            <th style="background-color: var(--navy-dark); text-align: center;">
                <div class="th-content" style="justify-content: center;"><i data-lucide="check-circle-2"></i> Achive</div>
            </th>
            <th style="background-color: var(--navy-dark); text-align: center;">
                <div class="th-content" style="justify-content: center;"><i data-lucide="alert-circle"></i> Not Achive</div>
            </th>
        </tr>
    `;
    tbody.innerHTML = `<tr><td colspan="15" style="text-align: center; padding: 20px; font-weight: 500; color: var(--text-secondary);">Memuat data matrix 12 bulan...</td></tr>`;
    tfoot.innerHTML = '';
    const isEastern = region === 'eastern';
    async function getEasternAggregatedDataSingle(m, y) {
        const branches = ['bekasi', 'bogor', 'karawang'];
        const branchRows = [];
        for (const b of branches) {
            const rawData = await getActiveData(b, m, y);
            let sumPct = 0, countPct = 0, sumAch = 0, sumNot = 0;
            let hasAnyData = false;
            rawData.forEach(r => {
                let pct = 0;
                let excelAch = r[`${selectedKpiKey}ExcelAch`];
                let excelNot = r[`${selectedKpiKey}ExcelNotAch`];
                if (selectedKpiKey === 'serviceAvailability') pct = r.serviceAvailability;
                else if (selectedKpiKey === 'assuranceGuarantee') pct = r.assuranceGuarantee;
                else if (selectedKpiKey === 'ttr3h') pct = r.ttr3h;
                else if (selectedKpiKey === 'ttr6h') pct = r.ttr6h;
                else if (selectedKpiKey === 'ttr36h') pct = r.ttr36h;
                else if (selectedKpiKey === 'ttrManja') pct = r.ttrManja;
                if ((pct !== undefined && pct > 0) || r.hasData) {
                    sumPct += (pct || 0);
                    countPct++;
                    hasAnyData = true;
                    const isAchieved = (pct || 0) >= targetSla;
                    const ach = excelAch !== undefined ? excelAch : (isAchieved ? 1 : 0);
                    const not = excelNot !== undefined ? excelNot : (isAchieved ? 0 : 1);
                    sumAch += ach;
                    sumNot += not;
                }
            });
            const branchObj = {
                sto: b.toUpperCase(),
                hasData: hasAnyData
            };
            branchObj[selectedKpiKey] = countPct > 0 ? (sumPct / countPct) : 0;
            branchObj[`${selectedKpiKey}ExcelAch`] = sumAch;
            branchObj[`${selectedKpiKey}ExcelNotAch`] = sumNot;
            branchRows.push(branchObj);
        }
        return branchRows;
    }
    const monthlyDataMap = {};
    for (const month of MONTHS_LIST) {
        monthlyDataMap[month] = isEastern ? await getEasternAggregatedDataSingle(month, year) : await getActiveData(region, month, year);
    }
    tbody.innerHTML = '';
    let stoList = [];
    if (isEastern) {
        stoList = ['BEKASI', 'BOGOR', 'KARAWANG'];
    } else if (AppState.selectedSto && AppState.selectedSto !== 'ALL') {
        stoList = [AppState.selectedSto];
    } else {
        const extraStos = new Set(AppState.stoLists[region] || []);
        MONTHS_LIST.forEach(m => {
            const list = monthlyDataMap[m] || [];
            list.forEach(d => {
                if (d && d.sto && d.hasData) extraStos.add(d.sto.toUpperCase());
            });
        });
        stoList = Array.from(extraStos);
    }
    const stoRowObjects = stoList.map(stoName => {
        let stoYearAchieved = 0;
        let stoYearUnachieved = 0;
        let stoYearSumPct = 0;
        let monthsWithDataCount = 0;
        const monthCells = [];
        let excelParsedRow = null;
        for (const m of MONTHS_LIST) {
            const list = monthlyDataMap[m] || [];
            const r = list.find(d => d.sto.toUpperCase() === stoName.toUpperCase());
            if (r && r[`${selectedKpiKey}ExcelAch`] !== undefined) {
                excelParsedRow = r;
                break;
            }
        }
        MONTHS_LIST.forEach(month => {
            const list = monthlyDataMap[month] || [];
            const stoRow = list.find(d => d.sto.toUpperCase() === stoName.toUpperCase()) || {};
            let pct = 0, tot = 0, ach = 0;
            let hasData = stoRow.hasData === true || (stoRow[selectedKpiKey] !== undefined && stoRow[selectedKpiKey] > 0);
            if (selectedKpiKey === 'serviceAvailability') { pct = stoRow.serviceAvailability || 0; }
            else if (selectedKpiKey === 'assuranceGuarantee') { pct = stoRow.assuranceGuarantee || 0; }
            else if (selectedKpiKey === 'ttr3h') { pct = stoRow.ttr3h || 0; }
            else if (selectedKpiKey === 'ttr6h') { pct = stoRow.ttr6h || 0; }
            else if (selectedKpiKey === 'ttr36h') { pct = stoRow.ttr36h || 0; }
            else if (selectedKpiKey === 'ttrManja') { pct = stoRow.ttrManja || 0; }
            if (hasData) {
                monthsWithDataCount++;
                stoYearSumPct += pct;
                if (!excelParsedRow) {
                    if (pct >= targetSla) {
                        stoYearAchieved += 1;
                    } else {
                        stoYearUnachieved += 1;
                    }
                }
            }
            monthCells.push({ month, pct, tot, ach, hasData });
        });
        if (excelParsedRow) {
            stoYearAchieved = excelParsedRow[`${selectedKpiKey}ExcelAch`];
            stoYearUnachieved = excelParsedRow[`${selectedKpiKey}ExcelNotAch`];
        }
        const avgPct = monthsWithDataCount > 0 ? (stoYearSumPct / monthsWithDataCount) : 0;
        return {
            stoName,
            stoYearAchieved,
            stoYearUnachieved,
            avgPct,
            monthCells
        };
    });
    const sortOrder = AppState.singleKpiSort || 'default';
    if (sortOrder === 'notAchieveDesc') {
        stoRowObjects.sort((a, b) => b.stoYearUnachieved - a.stoYearUnachieved);
    } else if (sortOrder === 'achieveDesc') {
        stoRowObjects.sort((a, b) => b.stoYearAchieved - a.stoYearAchieved);
    } else {
        stoRowObjects.sort((a, b) => a.stoName.localeCompare(b.stoName));
    }
    const monthTotals = {};
    MONTHS_LIST.forEach(m => {
        monthTotals[m] = { sumPct: 0, count: 0 };
    });
    let totalAllAchieved = 0;
    let totalAllUnachieved = 0;
    stoRowObjects.forEach((item, index) => {
        const tr = document.createElement('tr');
        let cellsHtml = `
            <td style="text-align: center; font-weight: 600;">${index + 1}</td>
            <td class="sticky-col">${item.stoName}</td>
        `;
        item.monthCells.forEach(cell => {
            if (cell.hasData) {
                monthTotals[cell.month].sumPct += cell.pct;
                monthTotals[cell.month].count += 1;
                cellsHtml += `
                    <td style="text-align: center; font-weight: 700; color: ${cell.pct < targetSla ? '#dc2626' : 'var(--navy-dark)'};">
                        ${formatPct(cell.pct)}
                    </td>
                `;
            } else {
                cellsHtml += `
                    <td style="text-align: center; color: var(--text-secondary); opacity: 0.4; font-weight: 500;">
                        -
                    </td>
                `;
            }
        });
        totalAllAchieved += item.stoYearAchieved;
        totalAllUnachieved += item.stoYearUnachieved;
        cellsHtml += `
            <td style="text-align: center; font-weight: 700; color: #059669; font-size: 13px; background-color: rgba(5, 150, 105, 0.04);">${item.stoYearAchieved}</td>
            <td style="text-align: center; font-weight: 700; color: ${item.stoYearUnachieved > 0 ? '#dc2626' : 'var(--text-secondary)'}; font-size: 13px; background-color: rgba(225, 29, 72, 0.04);">${item.stoYearUnachieved}</td>
        `;
        tr.innerHTML = cellsHtml;
        tbody.appendChild(tr);
    });
    const branchName = region === 'eastern' ? 'EASTERN' : region.toUpperCase();
    tfoot.innerHTML = `
        <tr>
            <td></td>
            <td class="sticky-col">${branchName}</td>
            ${MONTHS_LIST.map(m => {
        const mt = monthTotals[m];
        const avgPct = mt.count > 0 ? (mt.sumPct / mt.count) : 0;
        return `<td style="font-weight: 700; text-align: center;">${mt.count > 0 ? formatPct(avgPct) : '-'}</td>`;
    }).join('')}
            <td style="font-weight: 700; text-align: center; color: #34d399;">${totalAllAchieved}</td>
            <td style="font-weight: 700; text-align: center; color: ${totalAllUnachieved > 0 ? '#fca5a5' : '#ffffff'};">${totalAllUnachieved}</td>
        </tr>
    `;
    lucide.createIcons();
}
function updateWsaStoDropdown() {
    const stoSelect = document.getElementById('wsa-teritory2-select');
    if (!stoSelect) return;
    const region = AppState.activeRegion;
    const currentVal = stoSelect.value;
    stoSelect.innerHTML = '<option value="ALL">ALL STO</option>';
    let stos = [];
    if (region === 'eastern') {
        ['bekasi', 'bogor', 'karawang'].forEach(r => {
            stos.push(...(AppState.stoLists[r] || []));
        });
    } else {
        stos = AppState.stoLists[region] || [];
    }
    stos.forEach(sto => {
        const opt = document.createElement('option');
        opt.value = sto;
        opt.textContent = `STO ${sto}`;
        if (sto === currentVal) opt.selected = true;
        stoSelect.appendChild(opt);
    });
}
async function renderWsaDashboard() {
    updateWsaStoDropdown();
    const month = AppState.activeMonth;
    const year = AppState.activeYear || '2026';
    const activeRegion = AppState.activeRegion;
    const selectedSto = document.getElementById('wsa-teritory2-select')?.value || 'ALL';
    const branches = ['bekasi', 'bogor', 'karawang'];
    const branchStats = {};
    const stoStatsMap = {};
    for (const b of branches) {
        const rawData = await getActiveData(b, month, year);
        let sumSa = 0, countSa = 0;
        let sumAg = 0, countAg = 0;
        let sumT3 = 0, countT3 = 0;
        let sumT6 = 0, countT6 = 0;
        let sumT36 = 0, countT36 = 0;
        let sumManja = 0, countManja = 0;
        rawData.forEach(r => {
            if (r.serviceAvailability > 0) { sumSa += r.serviceAvailability; countSa++; }
            if (r.assuranceGuarantee > 0) { sumAg += r.assuranceGuarantee; countAg++; }
            if (r.ttr3h > 0) { sumT3 += r.ttr3h; countT3++; }
            if (r.ttr6h > 0) { sumT6 += r.ttr6h; countT6++; }
            if (r.ttr36h > 0) { sumT36 += r.ttr36h; countT36++; }
            if (r.ttrManja > 0) { sumManja += r.ttrManja; countManja++; }
            if (r.sto) {
                stoStatsMap[r.sto.toUpperCase()] = r;
            }
        });
        branchStats[b] = {
            serviceAvailability: countSa > 0 ? (sumSa / countSa) : 0,
            assuranceGuarantee: countAg > 0 ? (sumAg / countAg) : 0,
            ttr3h: countT3 > 0 ? (sumT3 / countT3) : 0,
            ttr6h: countT6 > 0 ? (sumT6 / countT6) : 0,
            ttr36h: countT36 > 0 ? (sumT36 / countT36) : 0,
            ttrManja: countManja > 0 ? (sumManja / countManja) : 0
        };
    }
    const monthIdx = MONTHS_LIST.indexOf(month);
    const prevMonth = monthIdx > 0 ? MONTHS_LIST[monthIdx - 1] : null;
    const prevBranchStats = {};
    const prevStoStatsMap = {};
    if (prevMonth) {
        for (const b of branches) {
            const prevRawData = await getActiveData(b, prevMonth, year);
            let sumSa = 0, countSa = 0;
            let sumAg = 0, countAg = 0;
            let sumT3 = 0, countT3 = 0;
            let sumT6 = 0, countT6 = 0;
            let sumT36 = 0, countT36 = 0;
            let sumManja = 0, countManja = 0;
            prevRawData.forEach(r => {
                if (r.serviceAvailability > 0) { sumSa += r.serviceAvailability; countSa++; }
                if (r.assuranceGuarantee > 0) { sumAg += r.assuranceGuarantee; countAg++; }
                if (r.ttr3h > 0) { sumT3 += r.ttr3h; countT3++; }
                if (r.ttr6h > 0) { sumT6 += r.ttr6h; countT6++; }
                if (r.ttr36h > 0) { sumT36 += r.ttr36h; countT36++; }
                if (r.ttrManja > 0) { sumManja += r.ttrManja; countManja++; }
                if (r.sto) {
                    prevStoStatsMap[r.sto.toUpperCase()] = r;
                }
            });
            prevBranchStats[b] = {
                serviceAvailability: countSa > 0 ? (sumSa / countSa) : 0,
                assuranceGuarantee: countAg > 0 ? (sumAg / countAg) : 0,
                ttr3h: countT3 > 0 ? (sumT3 / countT3) : 0,
                ttr6h: countT6 > 0 ? (sumT6 / countT6) : 0,
                ttr36h: countT36 > 0 ? (sumT36 / countT36) : 0,
                ttrManja: countManja > 0 ? (sumManja / countManja) : 0
            };
        }
    }
    const targetSlaMap = {
        serviceAvailability: 98.52,
        assuranceGuarantee: 91.71,
        ttr3h: 92.25,
        ttr6h: 95.00,
        ttr36h: 99.04,
        ttrManja: 94.69
    };
    const kpiKeys = ['serviceAvailability', 'assuranceGuarantee', 'ttr3h', 'ttr6h', 'ttr36h', 'ttrManja'];
    const cardIdMap = {
        serviceAvailability: 'sa',
        assuranceGuarantee: 'ag',
            ttr3h: 't3',
        ttr6h: 't6',
        ttr36h: 't36',
        ttrManja: 'manja'
    };
    const wsaSortOrder = document.getElementById('wsa-sort-select')?.value || 'desc';
    kpiKeys.forEach(kpiKey => {
        const target = targetSlaMap[kpiKey];
        let overallVal = 0;
        let prevVal = 0;
        if (selectedSto !== 'ALL' && stoStatsMap[selectedSto.toUpperCase()]) {
            overallVal = stoStatsMap[selectedSto.toUpperCase()][kpiKey] || 0;
        } else if (activeRegion === 'eastern') {
            const vals = branches.map(b => branchStats[b][kpiKey]).filter(v => v > 0);
            overallVal = vals.length > 0 ? (vals.reduce((a, b) => a + b, 0) / vals.length) : 0;
        } else if (branchStats[activeRegion]) {
            overallVal = branchStats[activeRegion][kpiKey];
        }
        if (prevMonth) {
            if (selectedSto !== 'ALL' && prevStoStatsMap[selectedSto.toUpperCase()]) {
                prevVal = prevStoStatsMap[selectedSto.toUpperCase()][kpiKey] || 0;
            } else if (activeRegion === 'eastern') {
                const pVals = branches.map(b => prevBranchStats[b] ? prevBranchStats[b][kpiKey] : 0).filter(v => v > 0);
                prevVal = pVals.length > 0 ? (pVals.reduce((a, b) => a + b, 0) / pVals.length) : 0;
            } else if (prevBranchStats[activeRegion]) {
                prevVal = prevBranchStats[activeRegion][kpiKey];
            }
        }
        const cardKey = cardIdMap[kpiKey];
        const valElem = document.getElementById(`wsa-val-${cardKey}`);
        const trendElem = document.getElementById(`wsa-trend-${cardKey}`);
        const badgeElem = document.getElementById(`wsa-badge-${cardKey}`);
        const isAchieved = overallVal >= target;
        if (valElem) {
            valElem.textContent = overallVal > 0 ? formatPct(overallVal) : '-';
            valElem.className = `wsa-card-val ${isAchieved ? 'achieved' : 'unachieved'}`;
        }
        if (badgeElem) {
            badgeElem.textContent = isAchieved ? '👍' : '👎';
        }
        if (trendElem) {
            let diffVal = 0;
            let titleText = '';
            if (prevVal > 0) {
                diffVal = overallVal - prevVal;
                titleText = `MoM vs ${prevMonth}: ${formatPct(prevVal)}`;
            } else if (overallVal > 0) {
                diffVal = overallVal - target;
                titleText = `Selisih vs Target SLA (${target}%) - Mengingat baru ada data 1 bulan`;
            }
            const diffStr = diffVal >= 0 ? `+${diffVal.toFixed(2)}%` : `${diffVal.toFixed(2)}%`;
            const sym = diffVal > 0 ? '▲' : (diffVal < 0 ? '▼' : '=');
            const cls = diffVal > 0 ? 'up' : (diffVal < 0 ? 'down' : 'equal');
            trendElem.className = `wsa-card-trend ${cls}`;
            trendElem.innerHTML = `<span class="trend-num">${diffStr}</span><span class="trend-sym">${sym}</span>`;
            trendElem.title = titleText;
        }
        const chartListElem = document.getElementById(`wsa-chart-${cardKey}-list`);
        if (chartListElem) {
            const gradients = ['gradient-1', 'gradient-2', 'gradient-3', 'gradient-4'];
            let displayItems = [];
            if (selectedSto !== 'ALL') {
                const stoData = stoStatsMap[selectedSto.toUpperCase()];
                displayItems = [{
                    label: selectedSto.toUpperCase(),
                    val: stoData ? (stoData[kpiKey] || 0) : 0
                }];
            } else if (activeRegion === 'eastern') {
                displayItems = branches.map(bName => ({
                    label: bName.toUpperCase(),
                    val: branchStats[bName] ? branchStats[bName][kpiKey] : 0
                })).sort((a, b) => wsaSortOrder === 'asc' ? a.val - b.val : b.val - a.val);
            } else {
                const stosInRegion = AppState.stoLists[activeRegion] || [];
                displayItems = stosInRegion.map(stoName => {
                    const stoData = stoStatsMap[stoName.toUpperCase()];
                    return {
                        label: stoName.toUpperCase(),
                        val: stoData ? (stoData[kpiKey] || 0) : 0
                    };
                }).sort((a, b) => wsaSortOrder === 'asc' ? a.val - b.val : b.val - a.val).slice(0, 5);
            }
            chartListElem.innerHTML = `
                <div class="wsa-target-line" style="left: ${target}%;" title="Target SLA: ${target}%"></div>
                ${displayItems.map((item, idx) => {
                    const fillPct = Math.min(100, Math.max(0, item.val));
                    const gradClass = gradients[idx % gradients.length];
                    return `
                        <div class="wsa-bar-item">
                            <span class="wsa-area-name" style="width: 85px;">${item.label}</span>
                            <div class="wsa-bar-wrapper">
                                <div class="wsa-bar-fill ${gradClass}" style="width: ${fillPct}%;">
                                    ${item.val > 0 ? formatPct(item.val) : ''}
                                </div>
                            </div>
                        </div>
                    `;
                }).join('')}
            `;
        }
    });
    lucide.createIcons();
}
async function renderTable() {
    const singleKpiSelector = document.getElementById('single-kpi-selector');
    const monthFilterSection = document.getElementById('month-filter-section');
    const tableTitle = document.getElementById('table-title');
    const filterKpi = document.getElementById('filter-kpi-item');
    const filterSort = document.getElementById('filter-sort-item');
    const tableView = document.getElementById('table-view-container');
    const wsaView = document.getElementById('wsa-dashboard-container');
    if (AppState.activePage === 'dashboard-wsa') {
        if (tableView) tableView.style.display = 'none';
        if (wsaView) wsaView.style.display = 'flex';
        await renderWsaDashboard();
    } else {
        if (tableView) tableView.style.display = 'block';
        if (wsaView) wsaView.style.display = 'none';
        if (AppState.activePage === 'all-kpi') {
            if (filterKpi) filterKpi.style.display = 'none';
            if (filterSort) filterSort.style.display = 'none';
            if (monthFilterSection) monthFilterSection.style.display = 'block';
            updateStoFilterDropdown();
            if (tableTitle) tableTitle.textContent = 'Ringkasan Semua KPI per STO';
            await renderAllKpiTable();
        } else {
            if (filterKpi) filterKpi.style.display = 'flex';
            if (filterSort) filterSort.style.display = 'flex';
            if (monthFilterSection) monthFilterSection.style.display = 'none';
            updateStoFilterDropdown();
            const kpiInfo = KPI_LABEL_MAP[AppState.selectedSingleKpi] || KPI_LABEL_MAP.serviceAvailability;
            if (tableTitle) tableTitle.textContent = `Tren ${kpiInfo.label} per STO (Jan - Des)`;
            await renderSingleKpiTable();
        }
    }
}
function updateHeaderInfo() {
    const capRegion = AppState.activeRegion.charAt(0).toUpperCase() + AppState.activeRegion.slice(1);
    document.getElementById('dashboard-title').textContent = 'Kendali Hasil Analisis & Laporan Informasi Lintas Area';
    const year = AppState.activeYear || '2026';
    if (AppState.activePage === 'dashboard-wsa') {
        document.getElementById('dashboard-subtitle').textContent = `STO ${capRegion} • Executive Dashboard WSA • Periode ${AppState.activeMonth} ${year}`;
    } else if (AppState.activePage === 'all-kpi') {
        document.getElementById('dashboard-subtitle').textContent = `STO ${capRegion} • Periode ${AppState.activeMonth} ${year} • Ringkasan Semua KPI`;
    } else {
        const kpiInfo = KPI_LABEL_MAP[AppState.selectedSingleKpi] || KPI_LABEL_MAP.serviceAvailability;
        document.getElementById('dashboard-subtitle').textContent = `STO ${capRegion} • Tren ${kpiInfo.label} • Tahun ${year}`;
    }
}
function syncNavUI() {
    document.querySelectorAll('.main-nav .nav-btn').forEach(btn => {
        if (btn.dataset.page === AppState.activePage) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });
    document.querySelectorAll('.region-btn').forEach(btn => {
        if (btn.dataset.region === AppState.activeRegion) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });
    const regionSection = document.getElementById('sidebar-region-section');
    if (regionSection) {
        if (AppState.activePage === 'dashboard-wsa') {
            regionSection.style.display = 'none';
        } else {
            regionSection.style.display = 'block';
        }
    }
    const wsaTeritory1 = document.getElementById('wsa-teritory1-select');
    if (wsaTeritory1 && AppState.activeRegion) {
        wsaTeritory1.value = AppState.activeRegion;
    }
}
function handleUIUpdate() {
    saveToLocalStorage();
    syncNavUI();
    updateHeaderInfo();
    renderTable();
}
async function downloadTemplate() {
    const dataRows = [];
    const currentYear = 2026;
    ['bogor', 'bekasi', 'karawang'].forEach(regionKey => {
        const capRegion = regionKey.charAt(0).toUpperCase() + regionKey.slice(1);
        const stos = AppState.stoLists[regionKey] || [];
        stos.forEach(sto => {
            dataRows.push({
                'Daerah': capRegion,
                'Tahun': currentYear,
                'Bulan': AppState.activeMonth,
                'STO': sto,
                'SERVICE AVAILABILITY TOTAL INCIDENT': '',
                'SERVICE AVAILABILITY ACHIEVED': '',
                'ASSURANCE GUARANTEE TOTAL INCIDENT': '',
                'ASSURANCE GUARANTEE ACHIEVED': '',
                'TTR 3H TOTAL INCIDENT': '',
                'TTR 3H ACHIEVED': '',
                'TTR 6H TOTAL INCIDENT': '',
                'TTR 6H ACHIEVED': '',
                'TTR 36H TOTAL INCIDENT': '',
                'TTR 36H ACHIEVED': '',
                'TTR 3H MANJA TOTAL INCIDENT': '',
                'TTR 3H MANJA ACHIEVED': ''
            });
        });
    });
    const hasXlsx = typeof XLSX !== 'undefined' && XLSX && XLSX.utils && typeof XLSX.utils.json_to_sheet === 'function' && typeof XLSX.utils.book_new === 'function' && typeof XLSX.writeFile === 'function';
    if (!hasXlsx) {
        const csvHeader = Object.keys(dataRows[0]).join(',');
        const csvBody = dataRows.map(row => Object.values(row).join(',')).join('\n');
        const blob = new Blob([`${csvHeader}\n${csvBody}`], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = `Template_Data_STO_${AppState.activeMonth}.csv`;
        anchor.style.display = 'none';
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
        URL.revokeObjectURL(url);
        showToast("Template berhasil diunduh sebagai CSV.", "success");
        return;
    }
    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.json_to_sheet(dataRows);
    worksheet['!cols'] = [
        { wch: 12 },
        { wch: 10 },
        { wch: 12 },
        { wch: 10 },
        { wch: 30 },
        { wch: 25 },
        { wch: 30 },
        { wch: 25 },
        { wch: 22 },
        { wch: 18 },
        { wch: 22 },
        { wch: 18 },
        { wch: 22 },
        { wch: 18 },
        { wch: 25 },
        { wch: 22 }
    ];
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Data STO');
    XLSX.writeFile(workbook, `Template_Data_STO_${AppState.activeMonth}.xlsx`);
    showToast("Template Excel kosongan berhasil diunduh!", "success");
}
function handleExcelUpload(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async function (event) {
        try {
            const dataArray = new Uint8Array(event.target.result);
            const workbook = XLSX.read(dataArray, { type: 'array' });
            const kpiSheetMap = {
                'serviceavailability': 'serviceAvailability',
                'assuranceguarantee': 'assuranceGuarantee',
                'ttr3hdv': 'ttr3h',
                'ttr3hd,v': 'ttr3h',
                'ttr6hp': 'ttr6h',
                'ttr36hnonhvc': 'ttr36h',
                'ttr3hmanja': 'ttrManja'
            };
            const matchedSheets = workbook.SheetNames.filter(sn => {
                const cleanName = sn.toLowerCase().replace(/[^a-z0-9]/g, '');
                return Object.keys(kpiSheetMap).some(k => cleanName.includes(k));
            });
            if (matchedSheets.length > 0) {
                const monthHeaderMap = [
                    { prefix: 'jan', monthName: 'Januari' },
                    { prefix: 'feb', monthName: 'Februari' },
                    { prefix: 'mar', monthName: 'Maret' },
                    { prefix: 'apr', monthName: 'April' },
                    { prefix: 'may', monthName: 'Mei' },
                    { prefix: 'mei', monthName: 'Mei' },
                    { prefix: 'jun', monthName: 'Juni' },
                    { prefix: 'jul', monthName: 'Juli' },
                    { prefix: 'aug', monthName: 'Agustus' },
                    { prefix: 'ags', monthName: 'Agustus' },
                    { prefix: 'sep', monthName: 'September' },
                    { prefix: 'oct', monthName: 'Oktober' },
                    { prefix: 'okt', monthName: 'Oktober' },
                    { prefix: 'nov', monthName: 'November' },
                    { prefix: 'dec', monthName: 'Desember' },
                    { prefix: 'des', monthName: 'Desember' }
                ];
                let totalUpdates = 0;
                matchedSheets.forEach(sheetName => {
                    const cleanSheetName = sheetName.toLowerCase().replace(/[^a-z0-9]/g, '');
                    let targetKpiKey = null;
                    for (const [k, v] of Object.entries(kpiSheetMap)) {
                        if (cleanSheetName.includes(k)) {
                            targetKpiKey = v;
                            break;
                        }
                    }
                    if (!targetKpiKey) return;
                    const sheet = workbook.Sheets[sheetName];
                    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });
                    if (rows.length < 2) return;
                    const monthCols = [];
                    let achColIdx = 15;
                    let notAchColIdx = 16;
                    rows.slice(0, 3).forEach(rowArr => {
                        if (!Array.isArray(rowArr)) return;
                        rowArr.forEach((cellVal, colIdx) => {
                            if (!cellVal) return;
                            const cellStr = String(cellVal).trim().toLowerCase();
                            if (cellStr.includes('not ach') || cellStr.includes('notach') || cellStr.includes('unachieved')) {
                                notAchColIdx = colIdx;
                            } else if (cellStr === 'ach' || cellStr === 'achieve' || cellStr === 'achieved') {
                                achColIdx = colIdx;
                            }
                            for (const mObj of monthHeaderMap) {
                                if (cellStr.includes(mObj.prefix)) {
                                    if (!monthCols.some(mc => mc.colIndex === colIdx || mc.monthName === mObj.monthName)) {
                                        monthCols.push({ colIndex: colIdx, monthName: mObj.monthName });
                                    }
                                    break;
                                }
                            }
                        });
                    });
                    rows.forEach((rowArr, rIdx) => {
                        if (rIdx < 1 || !Array.isArray(rowArr)) return;
                        let stoVal = rowArr[1] || rowArr[0];
                        if (!stoVal) return;
                        const stoUpper = String(stoVal).toUpperCase().trim();
                        if (stoUpper === 'STO' || stoUpper === 'AVG' || stoUpper === 'TOTAL' || stoUpper === 'ACH' || stoUpper.length > 8) return;
                        let stoRegion = AppState.activeRegion;
                        for (const [rKey, list] of Object.entries(AppState.stoLists)) {
                            if (list.includes(stoUpper)) {
                                stoRegion = rKey;
                                break;
                            }
                        }
                        monthCols.forEach(mc => {
                            const targetKey = `${stoRegion}_${AppState.activeYear}_${mc.monthName}`;
                            if (!AppState.customData[targetKey]) {
                                AppState.customData[targetKey] = generateEmptyData(stoRegion, mc.monthName, AppState.activeYear);
                            }
                            let stoItem = AppState.customData[targetKey].find(d => d.sto.toUpperCase() === stoUpper);
                            if (!stoItem) {
                                stoItem = {
                                    sto: stoUpper,
                                    serviceAvailability: 0, serviceAvailabilityTotal: 0, serviceAvailabilityAchieved: 0,
                                    assuranceGuarantee: 0, assuranceGuaranteeTotal: 0, assuranceGuaranteeAchieved: 0,
                                    ttr3h: 0, ttr3hTotal: 0, ttr3hAchieved: 0,
                                    ttr6h: 0, ttr6hTotal: 0, ttr6hAchieved: 0,
                                    ttr36h: 0, ttr36hTotal: 0, ttr36hAchieved: 0,
                                    ttrManja: 0, ttrManjaTotal: 0, ttrManjaAchieved: 0
                                };
                                AppState.customData[targetKey].push(stoItem);
                            }
                            const rawVal = rowArr[mc.colIndex];
                            if (rawVal !== undefined && rawVal !== null && rawVal !== '-' && !isNaN(parseFloat(rawVal))) {
                                let pct = parseFloat(rawVal);
                                pct = Math.min(100, Math.max(0, Math.round(pct * 100) / 100));
                                stoItem[targetKpiKey] = pct;
                                stoItem.hasData = true;
                                if (rowArr[achColIdx] !== undefined && !isNaN(parseInt(rowArr[achColIdx], 10))) {
                                    stoItem[`${targetKpiKey}ExcelAch`] = parseInt(rowArr[achColIdx], 10);
                                }
                                if (rowArr[notAchColIdx] !== undefined && !isNaN(parseInt(rowArr[notAchColIdx], 10))) {
                                    stoItem[`${targetKpiKey}ExcelNotAch`] = parseInt(rowArr[notAchColIdx], 10);
                                }
                                totalUpdates++;
                            }
                        });
                    });
                });
                saveToLocalStorage();
                handleUIUpdate();
                if (supabaseClient) {
                    try {
                        const upsertRows = [];
                        for (const [key, rowsList] of Object.entries(AppState.customData)) {
                            const parts = key.split('_');
                            if (parts.length >= 3) {
                                const reg = parts[0];
                                const yr = parts[1];
                                const mon = parts[2];
                                rowsList.forEach(row => {
                                    upsertRows.push({
                                        region: reg,
                                        year: yr,
                                        month: mon,
                                        sto: row.sto,
                                        service_availability: row.serviceAvailability,
                                        service_availability_total: row.serviceAvailabilityTotal || 10,
                                        service_availability_achieved: row.serviceAvailabilityAchieved || 10,
                                        service_availability_excel_ach: row.serviceAvailabilityExcelAch || 0,
                                        service_availability_excel_not_ach: row.serviceAvailabilityExcelNotAch || 0,
                                        assurance_guarantee: row.assuranceGuarantee,
                                        assurance_guarantee_total: row.assuranceGuaranteeTotal || 10,
                                        assurance_guarantee_achieved: row.assuranceGuaranteeAchieved || 10,
                                        assurance_guarantee_excel_ach: row.assuranceGuaranteeExcelAch || 0,
                                        assurance_guarantee_excel_not_ach: row.assuranceGuaranteeExcelNotAch || 0,
                                        ttr_3h: row.ttr3h,
                                        ttr_3h_total: row.ttr3hTotal || 10,
                                        ttr_3h_achieved: row.ttr3hAchieved || 10,
                                        ttr_3h_excel_ach: row.ttr3hExcelAch || 0,
                                        ttr_3h_excel_not_ach: row.ttr3hExcelNotAch || 0,
                                        ttr_6h: row.ttr6h,
                                        ttr_6h_total: row.ttr6hTotal || 10,
                                        ttr_6h_achieved: row.ttr6hAchieved || 10,
                                        ttr_6h_excel_ach: row.ttr6hExcelAch || 0,
                                        ttr_6h_excel_not_ach: row.ttr6hExcelNotAch || 0,
                                        ttr_36h: row.ttr36h,
                                        ttr_36h_total: row.ttr36hTotal || 10,
                                        ttr_36h_achieved: row.ttr36hAchieved || 10,
                                        ttr_36h_excel_ach: row.ttr36hExcelAch || 0,
                                        ttr_36h_excel_not_ach: row.ttr36hExcelNotAch || 0,
                                        ttr_3h_manja: row.ttrManja,
                                        ttr_3h_manja_total: row.ttrManjaTotal || 10,
                                        ttr_3h_manja_achieved: row.ttrManjaAchieved || 10,
                                        ttr_3h_manja_excel_ach: row.ttrManjaExcelAch || 0,
                                        ttr_3h_manja_excel_not_ach: row.ttrManjaExcelNotAch || 0
                                    });
                                });
                            }
                        }
                        if (upsertRows.length > 0) {
                            await supabaseClient
                                .from('sto_performance')
                                .upsert(upsertRows, { onConflict: 'region,year,month,sto' });
                            showToast("Data disinkronkan ke cloud database Supabase!", "success");
                        }
                    } catch (dbErr) {
                        console.error("Supabase upsert error:", dbErr);
                    }
                }
                const today = new Date();
                const timeString = `${String(today.getHours()).padStart(2, '0')}:${String(today.getMinutes()).padStart(2, '0')}`;
                const dateString = `${today.getDate()} ${['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Ags', 'Sep', 'Okt', 'Nov', 'Des'][today.getMonth()]} ${today.getFullYear()}`;
                const updateLabel = document.getElementById('data-update-text');
                if (updateLabel) {
                    updateLabel.innerHTML = `Sumber data: <strong>${file.name}</strong> • update terakhir ${dateString}, ${timeString}`;
                }
                showToast(`Berhasil membaca '${file.name}'! ${totalUpdates} poin data KPI berhasil diperbarui.`, "success");
                e.target.value = '';
                return;
            }
            const firstSheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[firstSheetName];
            const rows = XLSX.utils.sheet_to_json(worksheet);
            if (rows.length === 0) {
                showToast("File excel tidak memiliki baris data!", "error");
                return;
            }
            const getValByKeys = (rowObj, targetKeys) => {
                for (const tk of targetKeys) {
                    const foundKey = Object.keys(rowObj).find(rk => {
                        return rk.toLowerCase().replace(/[^a-z0-9]/g, '') === tk.toLowerCase().replace(/[^a-z0-9]/g, '');
                    });
                    if (foundKey !== undefined) {
                        return rowObj[foundKey];
                    }
                }
                return null;
            };
            const isFieldProvided = (rowObj, targetKeys) => {
                for (const tk of targetKeys) {
                    const foundKey = Object.keys(rowObj).find(rk => {
                        return rk.toLowerCase().replace(/[^a-z0-9]/g, '') === tk.toLowerCase().replace(/[^a-z0-9]/g, '');
                    });
                    if (foundKey !== undefined) {
                        const val = rowObj[foundKey];
                        if (val !== null && val !== undefined && String(val).trim() !== '') {
                            return true;
                        }
                    }
                }
                return false;
            };
            const targetKeysInFile = new Set();
            rows.forEach(row => {
                const sto = getValByKeys(row, ['sto', 'unit', 'namasto', 'nama_sto']);
                if (!sto) return;
                let rowRegion = getValByKeys(row, ['daerah', 'region', 'area']);
                const rowMonth = getValByKeys(row, ['bulan', 'month']);
                if (!rowRegion) {
                    const stoUpper = String(sto).toUpperCase().trim();
                    for (const [rKey, list] of Object.entries(AppState.stoLists)) {
                        if (list.includes(stoUpper)) {
                            rowRegion = rKey;
                            break;
                        }
                    }
                }
                let targetRegion = rowRegion ? String(rowRegion).toLowerCase().trim() : AppState.activeRegion;
                let targetMonth = rowMonth ? String(rowMonth).trim() : AppState.activeMonth;
                targetMonth = targetMonth.charAt(0).toUpperCase() + targetMonth.slice(1).toLowerCase();
                targetKeysInFile.add(`${targetRegion}_${AppState.activeYear}_${targetMonth}`);
            });
            const mergedData = {};
            for (const key of targetKeysInFile) {
                mergedData[key] = await getExistingGroupData(key);
            }
            let successfullyImportedCount = 0;
            rows.forEach(row => {
                const sto = getValByKeys(row, ['sto', 'unit', 'namasto', 'nama_sto']);
                if (!sto) return;
                let rowRegion = getValByKeys(row, ['daerah', 'region', 'area']);
                const rowMonth = getValByKeys(row, ['bulan', 'month']);
                if (!rowRegion) {
                    const stoUpper = String(sto).toUpperCase().trim();
                    for (const [rKey, list] of Object.entries(AppState.stoLists)) {
                        if (list.includes(stoUpper)) {
                            rowRegion = rKey;
                            break;
                        }
                    }
                }
                let targetRegion = rowRegion ? String(rowRegion).toLowerCase().trim() : AppState.activeRegion;
                let targetMonth = rowMonth ? String(rowMonth).trim() : AppState.activeMonth;
                targetMonth = targetMonth.charAt(0).toUpperCase() + targetMonth.slice(1).toLowerCase();
                const targetKey = `${targetRegion}_${AppState.activeYear}_${targetMonth}`;
                const stoUpper = String(sto).toUpperCase().trim();
                if (!mergedData[targetKey]) {
                    mergedData[targetKey] = {};
                }
                const existingSto = mergedData[targetKey][stoUpper] || {
                    sto: stoUpper,
                    serviceAvailability: 0, serviceAvailabilityTotal: 0, serviceAvailabilityAchieved: 0,
                    assuranceGuarantee: 0, assuranceGuaranteeTotal: 0, assuranceGuaranteeAchieved: 0,
                    ttr3h: 0, ttr3hTotal: 0, ttr3hAchieved: 0,
                    ttr6h: 0, ttr6hTotal: 0, ttr6hAchieved: 0,
                    ttr36h: 0, ttr36hTotal: 0, ttr36hAchieved: 0,
                    ttrManja: 0, ttrManjaTotal: 0, ttrManjaAchieved: 0
                };
                const parseCat = (prefixKeys, existingMetric) => {
                    const totalKeys = prefixKeys.map(k => [k + 'total', k + 'incident', 'total' + k, k + 'totalincident']).flat();
                    const achKeys = prefixKeys.map(k => [k + 'achieved', k + 'comply', k + 'achieve', 'achieved' + k, k + 'achievedincident']).flat();
                    const rawKeys = prefixKeys.map(k => ['ttr' + k, k]).flat();
                    const hasTotal = isFieldProvided(row, totalKeys);
                    const hasAchieved = isFieldProvided(row, achKeys);
                    const hasRaw = isFieldProvided(row, rawKeys);
                    if (hasTotal || hasAchieved) {
                        const tot = hasTotal ? Math.max(0, parseInt(getValByKeys(row, totalKeys), 10) || 0) : (existingMetric ? existingMetric.total : 0);
                        const ach = hasAchieved ? Math.max(0, parseInt(getValByKeys(row, achKeys), 10) || 0) : (existingMetric ? existingMetric.achieved : 0);
                        const pct = tot > 0 ? Math.min(100, Math.round((ach / tot) * 100)) : 100;
                        return { pct, total: tot, achieved: ach };
                    } else if (hasRaw) {
                        const rawVal = parseFloat(getValByKeys(row, rawKeys));
                        if (isNaN(rawVal)) {
                            return existingMetric || { pct: 0, total: 0, achieved: 0 };
                        }
                        const pct = Math.min(100, Math.max(0, Math.round(rawVal)));
                        const tot = existingMetric && existingMetric.total ? existingMetric.total : 10;
                        const ach = Math.round((pct / 100) * tot);
                        return { pct, total: tot, achieved: ach };
                    }
                    return existingMetric || { pct: 0, total: 0, achieved: 0 };
                };
                const saMetric = parseCat(['serviceavailability', 'availability', 'sa', 'domain'], { pct: existingSto.serviceAvailability, total: existingSto.serviceAvailabilityTotal, achieved: existingSto.serviceAvailabilityAchieved });
                const agMetric = parseCat(['assuranceguarantee', 'assurance', 'ag', 'fiber'], { pct: existingSto.assuranceGuarantee, total: existingSto.assuranceGuaranteeTotal, achieved: existingSto.assuranceGuaranteeAchieved });
                const t3Metric = parseCat(['ttr3h', '3h', 'odp'], { pct: existingSto.ttr3h, total: existingSto.ttr3hTotal, achieved: existingSto.ttr3hAchieved });
                const t6Metric = parseCat(['ttr6h', '6h', 'odc'], { pct: existingSto.ttr6h, total: existingSto.ttr6hTotal, achieved: existingSto.ttr6hAchieved });
                const t36Metric = parseCat(['ttr36h', '36h', 'nonhvc'], { pct: existingSto.ttr36h, total: existingSto.ttr36hTotal, achieved: existingSto.ttr36hAchieved });
                const manjaMetric = parseCat(['manja', 'ttr3hmanja', '3hmanja'], { pct: existingSto.ttrManja, total: existingSto.ttrManjaTotal, achieved: existingSto.ttrManjaAchieved });
                mergedData[targetKey][stoUpper] = {
                    sto: stoUpper,
                    serviceAvailability: saMetric.pct, serviceAvailabilityTotal: saMetric.total, serviceAvailabilityAchieved: saMetric.achieved,
                    assuranceGuarantee: agMetric.pct, assuranceGuaranteeTotal: agMetric.total, assuranceGuaranteeAchieved: agMetric.achieved,
                    ttr3h: t3Metric.pct, ttr3hTotal: t3Metric.total, ttr3hAchieved: t3Metric.achieved,
                    ttr6h: t6Metric.pct, ttr6hTotal: t6Metric.total, ttr6hAchieved: t6Metric.achieved,
                    ttr36h: t36Metric.pct, ttr36hTotal: t36Metric.total, ttr36hAchieved: t36Metric.achieved,
                    ttrManja: manjaMetric.pct, ttrManjaTotal: manjaMetric.total, ttrManjaAchieved: manjaMetric.achieved
                };
                successfullyImportedCount++;
            });
            if (successfullyImportedCount === 0) {
                showToast("Format Excel salah. Pastikan kolom STO tercantum!", "error");
                return;
            }
            const parsedDataGroups = {};
            for (const [key, stoMap] of Object.entries(mergedData)) {
                parsedDataGroups[key] = Object.values(stoMap);
            }
            if (supabaseClient) {
                try {
                    const upsertRows = [];
                    for (const [key, rowsList] of Object.entries(parsedDataGroups)) {
                        const parts = key.split('_');
                        if (parts.length >= 3) {
                            const reg = parts[0];
                            const yr = parts[1];
                            const mon = parts[2];
                            rowsList.forEach(row => {
                                upsertRows.push({
                                    region: reg,
                                    year: yr,
                                    month: mon,
                                    sto: row.sto,
                                    service_availability: row.serviceAvailability,
                                    service_availability_total: row.serviceAvailabilityTotal || 10,
                                    service_availability_achieved: row.serviceAvailabilityAchieved || 10,
                                    assurance_guarantee: row.assuranceGuarantee,
                                    assurance_guarantee_total: row.assuranceGuaranteeTotal || 10,
                                    assurance_guarantee_achieved: row.assuranceGuaranteeAchieved || 10,
                                    ttr_3h: row.ttr3h,
                                    ttr_3h_total: row.ttr3hTotal || 10,
                                    ttr_3h_achieved: row.ttr3hAchieved || 10,
                                    ttr_6h: row.ttr6h,
                                    ttr_6h_total: row.ttr6hTotal || 10,
                                    ttr_6h_achieved: row.ttr6hAchieved || 10,
                                    ttr_36h: row.ttr36h,
                                    ttr_36h_total: row.ttr36hTotal || 10,
                                    ttr_36h_achieved: row.ttr36hAchieved || 10,
                                    ttr_3h_manja: row.ttrManja,
                                    ttr_3h_manja_total: row.ttrManjaTotal || 10,
                                    ttr_3h_manja_achieved: row.ttrManjaAchieved || 10
                                });
                            });
                        }
                    }
                    if (upsertRows.length > 0) {
                        const { error } = await supabaseClient
                            .from('sto_performance')
                            .upsert(upsertRows, { onConflict: 'region,year,month,sto' });
                        if (error) throw error;
                        showToast("Data berhasil disinkronisasi ke cloud database Supabase!", "success");
                    }
                } catch (dbErr) {
                    console.error("Supabase upsert error:", dbErr);
                    showToast("Gagal menyinkronkan data ke cloud database. Disimpan secara lokal.", "error");
                }
            }
            Object.assign(AppState.customData, parsedDataGroups);
            saveToLocalStorage();
            handleUIUpdate();
            const today = new Date();
            const timeString = `${String(today.getHours()).padStart(2, '0')}:${String(today.getMinutes()).padStart(2, '0')}`;
            const dateString = `${today.getDate()} ${['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Ags', 'Sep', 'Okt', 'Nov', 'Des'][today.getMonth()]} ${today.getFullYear()}`;
            const updateLabel = document.getElementById('data-update-text');
            if (updateLabel) {
                updateLabel.innerHTML = `Sumber data: <strong>${file.name}</strong> • update terakhir ${dateString}, ${timeString}`;
            }
            showToast(`Berhasil memuat ${successfullyImportedCount} baris data ke sistem!`, "success");
        } catch (error) {
            console.error(error);
            showToast(`Gagal membaca file Excel: ${error.message}`, "error");
        }
    };
    reader.readAsArrayBuffer(file);
    e.target.value = '';
}
function initEvents() {
    document.querySelectorAll('.main-nav .nav-btn').forEach(btn => {
        btn.addEventListener('click', function () {
            document.querySelectorAll('.main-nav .nav-btn').forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            AppState.activePage = this.dataset.page;
            handleUIUpdate();
            document.getElementById('sidebar').classList.remove('open');
            document.getElementById('sidebar-overlay').classList.remove('active');
        });
    });
    document.querySelectorAll('.region-btn').forEach(button => {
        button.addEventListener('click', function () {
            document.querySelectorAll('.region-btn').forEach(btn => btn.classList.remove('active'));
            this.classList.add('active');
            AppState.activeRegion = this.dataset.region;
            updateStoFilterDropdown();
            handleUIUpdate();
            document.getElementById('sidebar').classList.remove('open');
            document.getElementById('sidebar-overlay').classList.remove('active');
        });
    });
    const yearSelect = document.getElementById('year-select');
    if (yearSelect) {
        yearSelect.addEventListener('change', function () {
            AppState.activeYear = this.value;
            handleUIUpdate();
        });
    }
    const monthSelect = document.getElementById('month-select');
    if (monthSelect) {
        monthSelect.addEventListener('change', function () {
            AppState.activeMonth = this.value;
            handleUIUpdate();
        });
    }
    const singleKpiSelect = document.getElementById('single-kpi-select');
    if (singleKpiSelect) {
        singleKpiSelect.addEventListener('change', function () {
            AppState.selectedSingleKpi = this.value;
            handleUIUpdate();
        });
    }
    const stoFilterSelect = document.getElementById('sto-filter-select');
    if (stoFilterSelect) {
        stoFilterSelect.addEventListener('change', function () {
            AppState.selectedSto = this.value;
            renderTable();
        });
    }
    const sortOrderSelect = document.getElementById('sort-order-select');
    if (sortOrderSelect) {
        sortOrderSelect.addEventListener('change', function () {
            AppState.singleKpiSort = this.value;
            renderTable();
        });
    }
    const wsaTeritory1 = document.getElementById('wsa-teritory1-select');
    if (wsaTeritory1) {
        wsaTeritory1.addEventListener('change', function () {
            AppState.activeRegion = this.value;
            const wsaStoSelect = document.getElementById('wsa-teritory2-select');
            if (wsaStoSelect) wsaStoSelect.value = 'ALL';
            handleUIUpdate();
        });
    }
    const wsaTeritory2 = document.getElementById('wsa-teritory2-select');
    if (wsaTeritory2) {
        wsaTeritory2.addEventListener('change', function () {
            handleUIUpdate();
        });
    }
    const wsaSortSelect = document.getElementById('wsa-sort-select');
    if (wsaSortSelect) {
        wsaSortSelect.addEventListener('change', function () {
            handleUIUpdate();
        });
    }
    const wsaApplyBtn = document.getElementById('wsa-filter-apply-btn');
    if (wsaApplyBtn) {
        wsaApplyBtn.addEventListener('click', function () {
            handleUIUpdate();
        });
    }
    document.addEventListener('click', function (e) {
        const btn = e.target.closest('.cell-dropdown-btn');
        if (btn) {
            const wrapper = btn.closest('.cell-dropdown-wrapper');
            const isActive = wrapper.classList.contains('active');
            document.querySelectorAll('.cell-dropdown-wrapper.active').forEach(el => el.classList.remove('active'));
            if (!isActive) wrapper.classList.add('active');
        } else if (!e.target.closest('.cell-dropdown-menu')) {
            document.querySelectorAll('.cell-dropdown-wrapper.active').forEach(el => el.classList.remove('active'));
        }
    });
    const fileInput = document.getElementById('excel-file-input');
    const uploadBtn = document.getElementById('upload-trigger-btn');
    if (uploadBtn && fileInput) {
        uploadBtn.addEventListener('click', () => fileInput.click());
        fileInput.addEventListener('change', handleExcelUpload);
    }
    const expandBtn = document.getElementById('sidebar-expand-btn');
    const collapseBtn = document.getElementById('sidebar-collapse-btn');
    const overlay = document.getElementById('sidebar-overlay');
    const sidebar = document.getElementById('sidebar');
    const appContainer = document.querySelector('.app-container');
    if (expandBtn && sidebar && overlay && appContainer) {
        expandBtn.addEventListener('click', () => {
            if (window.innerWidth > 1024) {
                appContainer.classList.remove('sidebar-collapsed');
            } else {
                sidebar.classList.add('open');
                overlay.classList.add('active');
            }
        });
    }
    if (collapseBtn && sidebar && overlay && appContainer) {
        collapseBtn.addEventListener('click', () => {
            if (window.innerWidth > 1024) {
                appContainer.classList.add('sidebar-collapsed');
            } else {
                sidebar.classList.remove('open');
                overlay.classList.remove('active');
            }
        });
    }
    if (overlay && sidebar) {
        overlay.addEventListener('click', () => {
            sidebar.classList.remove('open');
            overlay.classList.remove('active');
        });
    }
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            sessionStorage.removeItem('khalila_logged_in');
            window.location.reload();
        });
    }
}
const VALID_USERNAME = 'adminfbfa';
const VALID_PASSWORD = 'admin123';
function initSplitLoginInteractions() {
    const toggleBtn = document.getElementById('toggle-password-btn');
    const passInput = document.getElementById('password');
    const toggleIcon = document.getElementById('toggle-password-icon');
    if (toggleBtn && passInput && toggleIcon) {
        toggleBtn.addEventListener('click', () => {
            const isPass = passInput.type === 'password';
            passInput.type = isPass ? 'text' : 'password';
            toggleIcon.setAttribute('data-lucide', isPass ? 'eye-off' : 'eye');
            lucide.createIcons();
        });
    }
    const wrapper = document.getElementById('graphic-illustration-wrapper');
    const elements = document.querySelectorAll('.illu-element');
    if (wrapper && elements.length > 0) {
        wrapper.addEventListener('mousemove', (e) => {
            const rect = wrapper.getBoundingClientRect();
            const centerX = rect.left + rect.width / 2;
            const centerY = rect.top + rect.height / 2;
            const moveX = (e.clientX - centerX) / 25;
            const moveY = (e.clientY - centerY) / 25;
            elements.forEach(el => {
                const speed = parseFloat(el.getAttribute('data-speed')) || 1;
                el.style.transform = `translate(${moveX * speed}px, ${moveY * speed}px)`;
            });
        });
        wrapper.addEventListener('mouseleave', () => {
            elements.forEach(el => {
                el.style.transform = `translate(0px, 0px)`;
            });
        });
    }
}
function checkAuthAndInit() {
    initSplitLoginInteractions();
    const isLoggedIn = sessionStorage.getItem('khalila_logged_in');
    const loginOverlay = document.getElementById('login-overlay');
    const appContainer = document.getElementById('app-container');
    const loginForm = document.getElementById('login-form');
    const loginError = document.getElementById('login-error');
    if (!isLoggedIn) {
        if (loginOverlay) loginOverlay.classList.remove('hidden');
        if (appContainer) appContainer.style.display = 'none';
        if (loginForm) {
            loginForm.addEventListener('submit', (e) => {
                e.preventDefault();
                const user = document.getElementById('username').value;
                const pass = document.getElementById('password').value;
                if (user === VALID_USERNAME && pass === VALID_PASSWORD) {
                    sessionStorage.setItem('khalila_logged_in', 'true');
                    loginOverlay.classList.add('hidden');
                    appContainer.style.display = 'flex';
                    loginError.style.display = 'none';
                    initializeApp();
                } else {
                    loginError.style.display = 'flex';
                }
            });
        }
    } else {
        if (loginOverlay) loginOverlay.classList.add('hidden');
        if (appContainer) appContainer.style.display = 'flex';
        initializeApp();
    }
}
function initializeApp() {
    lucide.createIcons();
    loadFromLocalStorage();
    initEvents();
    handleUIUpdate();
}
document.addEventListener('DOMContentLoaded', () => {
    checkAuthAndInit();
});