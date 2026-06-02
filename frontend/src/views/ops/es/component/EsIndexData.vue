<template>
    <div class="es-index-data-box">
        <el-descriptions class="w-full! shrink-0" :column="20" size="small" border>
            <el-descriptions-item label-align="center">
                <template #label>
                    <SvgIcon name="Menu" />
                </template>
                <el-select v-model="currentIdxName" filterable :teleported="false" size="small" style="width: 200px" @change="onIndexChange">
                    <el-option v-for="idx in indices" :key="idx.index" :value="idx.index" :label="idx.index" />
                </el-select>
            </el-descriptions-item>
            <el-descriptions-item label-align="center">
                <template #label>
                    <SvgIcon name="PieChart" />
                </template>
                {{ currentIdxInfo?.['store.size'] }}
            </el-descriptions-item>
            <el-descriptions-item label-align="center">
                <template #label>
                    <el-space><SvgIcon name="refresh" @click="onRefreshStats" /> {{ t('es.docs') }}</el-space>
                </template>
                {{ currentIdxInfo?.['docs.count'] }}
            </el-descriptions-item>
            <el-descriptions-item :label="t('es.health')" label-align="center">
                <el-tag size="small" :type="getHealthTagType(currentIdxInfo?.health)">{{ currentIdxInfo?.health }}</el-tag>
            </el-descriptions-item>
            <el-descriptions-item :label="t('es.status')" label-align="center">
                <el-tag size="small" :type="currentIdxInfo?.status === 'open' ? 'success' : 'danger'">{{ currentIdxInfo?.status }}</el-tag>
            </el-descriptions-item>
        </el-descriptions>

        <el-row class="es-op-header shrink-0">
            <el-col :span="20">
                <el-space>
                    <el-link @click="onRefreshData" icon="refresh" underline="never" :title="t('common.refresh')"/>
                    <el-link @click="onBasicSearch" icon="Search" underline="never" :title="t('es.opSearch')"/>
                    <el-link v-auth="perms.saveData" @click="onAddDoc" icon="plus" underline="never" :title="t('common.create')" />
                    <el-link v-auth="perms.delData" :disabled="state.selectKeys.length === 0" @click="onDeleteDocs" icon="Minus" underline="never" :title="t('common.delete')"/>
                    <el-link v-auth="perms.saveData" :disabled="state.selectKeys.length !== 1" @click="onEditSelectDoc" icon="EditPen" underline="never" :title="t('common.edit')"/>
                    <el-link :disabled="state.search.from === 0" @click="onFirstPage" icon="DArrowLeft" underline="never" :title="t('es.page.home')" />
                    <el-link :disabled="state.search.from === 0" @click="onPrevPage" icon="ArrowLeft" underline="never" :title="t('es.page.prev')"/>
                    <el-dropdown placement="bottom" size="small" :teleported="false" :title="t('es.page.changeSize')">
                        <el-link underline="never" :style="{ fontSize: '12px' }">
                            {{ state.currentFrom + 1 }} - {{ Math.min(state.currentFrom + state.search.size, state.total) }}</el-link
                        >
                        <template #dropdown>
                            <el-dropdown-menu>
                                <el-dropdown-item @click="onChangePageSize(25)">25</el-dropdown-item>
                                <el-dropdown-item @click="onChangePageSize(50)">50</el-dropdown-item>
                                <el-dropdown-item @click="onChangePageSize(100)">100</el-dropdown-item>
                                <el-dropdown-item @click="onChangePageSize(200)">200</el-dropdown-item>
                                <el-dropdown-item @click="onChangePageSize(1000)">1000</el-dropdown-item>
                            </el-dropdown-menu>
                        </template>
                    </el-dropdown>
                    /
                    <el-link
                        underline="never"
                        @click="onSwitchTrackTotal"
                        :type="state.search.track_total_hits === true ? 'success' : 'info'"
                        :style="{ fontSize: '12px' }"
                        :title="t('es.page.total')"
                    >
                        {{ state.searchRes.hits?.total?.value || 0 }}</el-link
                    >
                    <el-link
                        :disabled="state.search.from + state.search.size >= (state.total || 0)"
                        @click="onNextPage"
                        icon="ArrowRight"
                        underline="never"
                        :title="t('es.page.next')"
                    />

                    <el-dropdown placement="bottom" size="small" :max-height="300" :hide-on-click="false" trigger="click" :teleported="false" :title="t('es.opViewColumns')">
                        <el-link icon="Operation" underline="never" />
                        <template #dropdown>
                            <el-dropdown-menu class="dropdown-menu">
                                <el-dropdown-item>
                                    <el-space>
                                        <el-checkbox @change="onCheckAllColumns" v-model="state.checkAllColumns" />
                                        <el-input
                                            v-model="state.columnsFilterText"
                                            @input="onFilterColumns"
                                            :placeholder="t('es.filterColumn')"
                                            clearable
                                            size="small"
                                        />
                                    </el-space>
                                </el-dropdown-item>
                                <template v-for="column in state.columns" :key="column.key">
                                    <el-dropdown-item v-if="column._filterd" :command="column.key">
                                        <el-checkbox v-model="column._show" @change="onCheckColumnFilter(column)">
                                            {{ column.title }}
                                        </el-checkbox>
                                    </el-dropdown-item>
                                </template>
                            </el-dropdown-menu>
                        </template>
                    </el-dropdown>

                    <el-link @click="onOpenExportDialog" icon="Download" underline="never" :title="t('es.export.title')" />
                </el-space>
            </el-col>
        </el-row>

        <div class="es-table-data flex-1 min-h-0">
            <el-auto-resizer>
                <template #default="{ height, width }">
                    <el-table-v2
                        ref="tableRef"
                        :row-height="state.rowHeight"
                        :columns="state.columns"
                        :data="state.datas"
                        :width="width"
                        :height="height"
                        fixed
                        :header-height="22"
                        class="es-table"
                        :row-class="({ rowIndex }) => state.datas[rowIndex]?._selected ? 'es-row-selected' : ''"
                        :row-event-handlers="rowEventHandlers"
                    >
                        <template #header="{ columns }">
                            <div
                                v-for="(column, i) in columns"
                                :key="i"
                                :style="{
                                    width: `${column.width}px`,
                                    textAlign: 'center',
                                    borderRight: 'var(--el-table-border)',
                                }"
                            >
                                <el-checkbox
                                    :style="{ height: '100%' }"
                                    v-if="column.key === '_selected'"
                                    v-model="state.selectAll"
                                    @change="onSelectAll"
                                    :indeterminate="state.selectKeys.length > 0 && !state.selectAll"
                                />
                                <b v-else> {{ column.title }} </b>
                            </div>
                        </template>

                        <template #cell="{ rowData, column, rowIndex, columnIndex }">
                            <div v-if="column.key === '_table_index'" class="table-data-cell">
                                <span class="el-text el-text--small is-truncated">
                                    {{ rowIndex + 1 + state.currentFrom }}
                                </span>
                            </div>
                            <div v-if="column.key === '_selected'" class="table-data-cell">
                                <span class="el-text el-text--small is-truncated">
                                    <el-checkbox v-model="rowData._selected" @change="onSelectRow(rowData)" />
                                </span>
                            </div>
                            <div v-else @contextmenu="dataContextmenuClick($event, rowIndex, column, rowData)" class="table-data-cell">
                                <span v-if="rowData[column.dataKey] === null" style="color: var(--el-color-info-light-5)"> NULL </span>
                                <span v-else :title="rowData[column.dataKey]" class="el-text el-text--small is-truncated">
                                    {{ rowData[column.dataKey] }}
                                </span>
                            </div>
                        </template>

                        <template v-if="state.loading" #overlay>
                            <div class="el-loading-mask flex flex-col items-center justify-center">
                                <div>
                                    <SvgIcon class="is-loading" name="loading" color="var(--el-color-primary)" :size="28" />
                                    <el-text class="ml-1" tag="b">{{ t('db.execTime') }} - {{ state.execTime?.toFixed(1) || 0 }}s</el-text>
                                </div>
                                <div v-if="state.loading && state.abortSearch" class="mt-2!">
                                    <el-button @click="state.abortSearch" type="info" size="small" plain>{{ t('common.cancel') }}</el-button>
                                </div>
                            </div>
                        </template>
                    </el-table-v2>
                </template>
            </el-auto-resizer>
        </div>

        <es-search :instId="instId" :idxName="currentIdxName" :fields="state.fields" v-model:visible="state.searchDialogVisible" @search="onEsSearch" />

        <Contextmenu :dropdown="state.contextmenu.dropdown" :items="state.contextmenu.items" ref="contextmenuRef" />

        <EsEditRow v-model="docEditDialog" v-model:visible="docEditDialog.visible" @success="onEditRowSuccess" />

        <!-- Export Dialog -->
        <el-dialog v-model="exportDialog.visible" :title="t('es.export.title')" width="480px" :teleported="false">
            <el-space direction="vertical" fill style="width: 100%">
                <el-alert
                    v-if="state.selectKeys.length > 0"
                    :title="t('es.export.selectedCount', { count: state.selectKeys.length })"
                    type="info"
                    :closable="false"
                    show-icon
                />
                <el-radio-group v-model="exportDialog.scope">
                    <el-radio value="selected" :disabled="state.selectKeys.length === 0">{{ t('es.export.exportSelected') }}</el-radio>
                    <el-radio value="query" :disabled="!hasCustomQuery">{{ t('es.export.exportQuery') }}</el-radio>
                    <el-radio value="all">{{ t('es.export.exportAll') }}</el-radio>
                </el-radio-group>
                <el-alert
                    v-if="(exportDialog.scope === 'all' && exportDialog.queryTotal > 10000) || (exportDialog.scope === 'query' && exportDialog.queryTotal > 10000) || (exportDialog.scope === 'selected' && state.selectKeys.length > 10000)"
                    :title="t('es.export.largeExportTip', { total: exportDialog.scope === 'selected' ? state.selectKeys.length : (exportDialog.queryTotal >= 0 ? exportDialog.queryTotal : '...') })"
                    type="warning"
                    :closable="false"
                    show-icon
                />
                <div>
                    <div class="el-text mb-1">{{ t('es.export.exportType') }}</div>
                    <el-radio-group v-model="exportDialog.type">
                        <el-radio-button value="csv">{{ t('es.export.csv') }}</el-radio-button>
                        <el-radio-button value="excel">{{ t('es.export.excel') }}</el-radio-button>
                        <el-radio-button value="json">{{ t('es.export.json') }}</el-radio-button>
                    </el-radio-group>
                </div>
                <div>
                    <div class="el-text mb-1">{{ t('es.export.exportFields') }}</div>
                    
                    <el-checkbox v-model="exportDialog.allFields" @change="onExportFieldsToggle" class="mb-1">
                        {{ t('es.export.selectAllFields') }}
                    </el-checkbox>
                    <div class="export-fields-group">
                        <el-checkbox-group v-model="exportDialog.fields" @change="onExportFieldsChange">
                            <el-checkbox v-for="field in state.fields" :key="field" :value="field" :label="field" />
                        </el-checkbox-group>
                    </div>
                </div>
            </el-space>
            <template #footer>
                <div v-if="exportDialog.progress" class="mb-2">
                    <div class="flex items-center justify-between mb-1">
                        <span class="el-text el-text--small">
                            {{ t(`es.export.phase.${exportDialog.progress.phase}`) }}
                        </span>
                        <span class="el-text el-text--small" v-if="exportDialog.progress.total > 0">
                            {{ exportDialog.progress.processed }} / {{ exportDialog.progress.total }}
                            ({{ Math.round((exportDialog.progress.processed / exportDialog.progress.total) * 100) }}%)
                        </span>
                    </div>
                    <el-progress
                        :percentage="exportDialog.progress.total > 0 ? Math.round((exportDialog.progress.processed / exportDialog.progress.total) * 100) : 0"
                        :status="exportDialog.progress.error ? 'exception' : exportDialog.progress.done ? 'success' : undefined"
                        :stroke-width="6"
                    />
                </div>
                <el-button @click="exportDialog.visible = false">{{ t('common.cancel') }}</el-button>
                <el-button type="primary" :loading="exportDialog.loading" :disabled="exportDialog.fields.length === 0" @click="onConfirmExport">
                    {{ t('es.export.confirm') }}
                </el-button>
            </template>
        </el-dialog>
    </div>
</template>

<script lang="tsx" setup>
import Api from '@/common/Api';
import { exportCsv, exportExcel, exportFile } from '@/common/utils/export';
import { copyToClipboard } from '@/common/utils/string';
import { getClientId, getToken } from '@/common/utils/storage';
import { Contextmenu, ContextmenuItem } from '@/components/contextmenu';
import SvgIcon from '@/components/svgIcon/index.vue';
import { Msg, useI18nDeleteConfirm } from '@/hooks/useI18n';
import { esApi } from '@/views/ops/es/api';
import { useIntervalFn } from '@vueuse/core';
import { computed, defineAsyncComponent, onMounted, reactive, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';

const EsSearch = defineAsyncComponent(() => import('./EsSearch.vue'));

const props = defineProps<{
    instId: any;
}>();

const { t } = useI18n();

const perms = {
    saveData: 'es:data:save',
    delData: 'es:data:del',
};

const tooltipTime = 300;

const getDefaultSearch = () => ({ sort: {}, query: { bool: { must: [], should: [], must_not: [] } }, aggs: {}, from: 0, size: 25 });

// Doc edit dialog state
const EsEditRow = defineAsyncComponent(() => import('../component/EsEditRow.vue'));

const docEditDialog = reactive({
    isAdd: true,
    instId: '' as any,
    doc: '',
    idxName: '',
    _id: '',
    visible: false,
});

// Export dialog state
const exportDialog = reactive({
    visible: false,
    scope: 'selected' as 'selected' | 'query' | 'all',
    type: 'csv' as 'csv' | 'excel' | 'json',
    fields: [] as string[],
    allFields: true,
    loading: false,
    queryTotal: -1, // -1 means not queried yet
    queryTotalLoading: false,
    progress: null as null | { total: number; processed: number; phase: string; done: boolean; error?: string },
    progressTimer: null as ReturnType<typeof setInterval> | null,
});

const state = reactive({
    columns: [] as any[],
    fields: [] as string[],
    datas: [] as any[],
    total: 0,
    searchRes: {} as any,
    rowHeight: 30,
    selectAll: false,
    selectKeys: [] as any[],
    lastSelectedIndex: -1,
    columnsFilterText: '',
    checkAllColumns: true,
    loading: true,
    abortSearch: () => {},
    execTime: 0,
    currentFrom: 25,
    search: getDefaultSearch(),
    searchDialogVisible: false,
    contextmenu: { items: [] as any[], dropdown: { x: 0, y: 0 } },
});

// Internal index state for self-contained index switching
const currentIdxName = ref('');
const currentIdxInfo = ref<any>(null);
const indices = ref<any[]>([]);

const contextmenuRef = ref();
const tableRef = ref();

const emits = defineEmits(['init']);

onMounted(async () => {
    await fetchIndices();
    setTimeout(fetchIndexData, 300);
});

const fetchIndices = async () => {
    const res = await esApi.proxyReq('get', props.instId, `/_cat/indices/?h=index,health,status,uuid,pri,rep,docs.count,docs.deleted,store.size,sc,cd`);
    indices.value = (res || []).filter((idx: any) => !idx.index.startsWith('.')).sort((a: any, b: any) => a.index.localeCompare(b.index));
    // Auto-select first index if no idxName provided
    if (!currentIdxName.value && indices.value.length > 0) {
        currentIdxName.value = indices.value[0].index;
        currentIdxInfo.value = indices.value[0];
    } else if (currentIdxName.value) {
        currentIdxInfo.value = indices.value.find((idx: any) => idx.index === currentIdxName.value) || currentIdxInfo.value;
    }
};

const onIndexChange = (name: string) => {
    currentIdxInfo.value = indices.value.find((idx: any) => idx.index === name) || null;
    state.search = getDefaultSearch();
    fetchIndexData();
};

// ---- Data fetching ----

const fetchIndexData = async () => {
    if (!currentIdxName.value) return;
    state.execTime = 0;
    const { pause, resume } = useIntervalFn(() => {
        state.execTime += 0.1;
    }, 100);
    resume();
    state.loading = true;

    state.selectAll = false;
    state.selectKeys = [];
    state.lastSelectedIndex = -1;

    let api = Api.newPost(`/es/instance/proxy/${props.instId}/${currentIdxName.value}/_search`);

    const { execute: execSearch, data: searchRes, abort: abortSearch } = api.useApi(state.search, { esProxyReq: true });
    state.abortSearch = () => {
        abortSearch();
        state.loading = false;
        pause();
    };
    await execSearch();
    state.searchRes = searchRes;
    let error = searchRes.value.error || (searchRes.value.failures && searchRes.value.failures.length > 0 && searchRes.value.failures[0]);
    if (error) {
        state.loading = false;
        pause();
        return await esApi.alertError(error, t('es.execError'));
    }

    let fieldMap = {} as any;
    fieldMap['_id'] = { width: 50 };

    state.datas = state.searchRes.hits.hits.map((a: any) => {
        let src = JSON.parse(JSON.stringify(a._source));
        src._id = a._id;
        let source = a._source;
        source._id = a._id;
        source._score = a._score;
        fieldMap['_score'] = { width: 40 };
        for (let k in source) {
            if (typeof source[k] != 'string' && typeof source[k] != 'number' && source[k] !== null && typeof source[k] != 'boolean') {
                source[k] = JSON.stringify(source[k]);
            }
            let column = fieldMap[k] || { width: 50 };
            try {
                let valLength = source[k] ? Math.max(source[k].length, k.length) : k.length;
                column.width = Math.max(Math.max(Math.min(220, (valLength || 10) * 10), 50), column.width);
            } catch (e) {
                console.log(e);
                column.width = 50;
            }
            fieldMap[k] = column;
        }
        source.src = JSON.stringify(src, null, 2);
        source._selected = false;
        return source;
    });

    state.total = state.searchRes.hits?.total.value || 0;

    if (state.datas.length > 0) {
        let keys = Object.keys(fieldMap).sort();
        state.fields = keys.filter((k) => k != '_score');
        state.columns = keys.map((k) => ({ title: k, width: fieldMap[k].width, key: k, dataKey: k, class: 'es-table-column', _filterd: true, _show: true }));
        state.columns.unshift({
            title: '#',
            width: 50,
            key: '_table_index',
            class: 'es-table-column',
            align: 'center',
            _filterd: false,
        });
        state.columns.unshift({
            title: 'checkbox',
            width: 30,
            key: '_selected',
            class: 'es-table-column',
            align: 'center',
            _filterd: false,
        });
    }
    pause();
    state.loading = false;
    state.currentFrom = state.search.from;
};

// ---- Pagination ----

const onChangePageSize = async (size: number) => {
    state.search.size = size;
    state.search.from = 0;
    await fetchIndexData();
};

const onFirstPage = async () => {
    state.search.from = 0;
    await fetchIndexData();
};

const onNextPage = async () => {
    state.search.from = state.search.from + state.search.size;
    await fetchIndexData();
};

const onPrevPage = async () => {
    state.search.from = Math.max(0, state.search.from - state.search.size);
    await fetchIndexData();
};

const onSwitchTrackTotal = async () => {
    if (!state.search.track_total_hits && state.total === 10000) {
        state.search.track_total_hits = true;
    } else {
        delete state.search.track_total_hits;
    }
    if (state.total >= 10000) {
        await fetchIndexData();
    }
};

// ---- Refresh ----

const refreshIndex = async () => {
    await esApi.proxyReq('post', props.instId, `/${currentIdxName.value}/_refresh`);
};

const onRefreshData = async () => {
    await fetchIndexData();
};

const onRefreshStats = async () => {
    const name = currentIdxName.value;
    let stats = await esApi.proxyReq('get', props.instId, `/${name}/_stats`);
    if (currentIdxInfo.value) {
        currentIdxInfo.value['docs.count'] = stats.indices[name]?.primaries?.docs?.count;
        if (stats.indices[name]?.health) currentIdxInfo.value.health = stats.indices[name].health;
        if (stats.indices[name]?.status) currentIdxInfo.value.status = stats.indices[name].status;
    }
};

// ---- Doc CRUD ----

const onAddDoc = () => {
    docEditDialog.isAdd = true;
    docEditDialog.instId = props.instId;
    docEditDialog.idxName = currentIdxName.value;
    docEditDialog._id = '';
    docEditDialog.doc = '';
    docEditDialog.visible = true;
};

const onEditDoc = (src: any) => {
    docEditDialog.isAdd = false;
    docEditDialog.instId = props.instId;
    docEditDialog.idxName = currentIdxName.value;
    const obj = JSON.parse(src);
    docEditDialog._id = obj._id;
    delete obj._id;
    docEditDialog.doc = JSON.stringify(obj, null, 2);
    docEditDialog.visible = true;
};

const onEditSelectDoc = () => {
    if (state.selectKeys.length > 1 || state.selectKeys.length == 0) {
        Msg.warning('common.pleaseSelectOne');
        return;
    }
    onEditDoc(state.selectKeys[0].src);
};

const onEditRowSuccess = async () => {
    docEditDialog.visible = false;
    await refreshIndex();
    await fetchIndexData();
};

const onDeleteDocs = async () => {
    let ids = state.selectKeys.map((d: any) => d._id);
    await useI18nDeleteConfirm(ids.join(', '));
    await doDeleteDoc(ids);
};

const doDeleteDoc = async (ids: any[]) => {
    await esApi.proxyReq('post', props.instId, `/${currentIdxName.value}/_delete_by_query`, {
        query: { terms: { _id: ids } },
    });
    Msg.deleteSuccess();
    await refreshIndex();
    setTimeout(async () => {
        await fetchIndexData();
    }, 500);
};

// ---- Search ----

const onBasicSearch = () => {
    if (!currentIdxName.value) {
        Msg.warning('es.selectIndexFirst');
        return;
    }
    state.searchDialogVisible = true;
};

const onEsSearch = async (data: any) => {
    data.from = 0;
    data.size = state.search.size;
    state.search = data;
    await fetchIndexData();
    state.searchDialogVisible = false;
};

// ---- Column filter ----

const onCheckColumnFilter = (column: any) => {
    column.hidden = !column._show;
};

const onCheckAllColumns = () => {
    state.columns.forEach((c: any) => {
        if (c.key != '_table_index' && c.key != '_selected') {
            c._show = state.checkAllColumns;
            c.hidden = !c._show;
        }
    });
};

const onFilterColumns = () => {
    if (!state.columnsFilterText) {
        state.columns.forEach((c: any) => {
            if (c.key != '_table_index' && c.key != '_selected') {
                c._filterd = true;
            }
        });
    } else {
        state.columns.forEach((c: any) => {
            if (c.key != '_table_index' && c.key != '_selected') {
                c._filterd = c.key.toLowerCase().indexOf(state.columnsFilterText.toLowerCase()) > -1;
            }
        });
    }
};

// ---- Row selection ----

const updateSelectAll = () => {
    state.selectAll = state.datas.length > 0 && state.datas.every((d: any) => d._selected);
};

const onSelectAll = () => {
    state.lastSelectedIndex = -1;
    state.datas.forEach((d: any) => (d._selected = state.selectAll));
    if (!state.selectAll) {
        state.selectKeys = [];
    } else {
        state.selectKeys = state.datas;
    }
};

const onSelectRow = (item: any) => {
    if (item._selected) {
        state.selectKeys.push(item);
    } else {
        state.selectKeys = state.selectKeys.filter((d: any) => d._id != item._id);
    }
    state.lastSelectedIndex = state.datas.findIndex((d: any) => d._id === item._id);
    updateSelectAll();
};

const onRowClickHandler = ({ rowData, rowIndex, event }: { rowData: any; rowIndex: number; event: Event }) => {
    const mouseEvent = event as MouseEvent;
    // Ignore clicks on the checkbox column (checkbox has its own handler)
    const target = mouseEvent.target as HTMLElement;
    if (target.closest('.el-checkbox') || target.closest('.el-checkbox__input')) return;

    if (mouseEvent.shiftKey && state.lastSelectedIndex >= 0) {
        // Shift + click: range select
        const start = Math.min(state.lastSelectedIndex, rowIndex);
        const end = Math.max(state.lastSelectedIndex, rowIndex);
        for (let i = start; i <= end; i++) {
            if (!state.datas[i]._selected) {
                state.datas[i]._selected = true;
                state.selectKeys.push(state.datas[i]);
            }
        }
    } else if (mouseEvent.ctrlKey || mouseEvent.metaKey) {
        // Ctrl/Cmd + click: toggle single row
        state.datas[rowIndex]._selected = !state.datas[rowIndex]._selected;
        if (state.datas[rowIndex]._selected) {
            state.selectKeys.push(state.datas[rowIndex]);
        } else {
            state.selectKeys = state.selectKeys.filter((d: any) => d._id !== rowData._id);
        }
        state.lastSelectedIndex = rowIndex;
    } else {
        // Normal click: clear all, select this row only
        state.datas.forEach((d: any) => (d._selected = false));
        state.selectKeys = [];
        state.datas[rowIndex]._selected = true;
        state.selectKeys = [state.datas[rowIndex]];
        state.lastSelectedIndex = rowIndex;
    }
    updateSelectAll();
};

const rowEventHandlers = {
    onClick: onRowClickHandler,
};

// ---- Context menu ----

const copyCell = new ContextmenuItem('copyCell', 'common.copyCell').withIcon('CopyDocument').withOnClick(async (data: any) => {
    await copyToClipboard(data.rowData[data.column.dataKey]);
});

const copyLineJson = new ContextmenuItem('copyLineJson', 'es.contextmenu.index.copyLineJson').withIcon('CopyDocument').withOnClick(async (data: any) => {
    await copyToClipboard(data.rowData.src);
});

const copySelectLineJson = new ContextmenuItem('copySelectLineJson', 'es.contextmenu.index.copySelectLineJson')
    .withIcon('CopyDocument')
    .withHideFunc(() => state.selectKeys?.length == 0)
    .withOnClick(async () => {
        await copyToClipboard(
            JSON.stringify(
                state.selectKeys.map((a: any) => JSON.parse(a.src)),
                null,
                2
            )
        );
    });

const editLineJson = new ContextmenuItem('editLineJson', 'common.edit').withIcon('EditPen').withOnClick(async (data: any) => onEditDoc(data.rowData.src));

const deleteLine = new ContextmenuItem('deleteLine', 'common.delete').withIcon('Delete').withOnClick(async (data: any) => {
    let ids = [data.rowData._id];
    await useI18nDeleteConfirm(ids.join(', '));
    await doDeleteDoc(ids);
});

const deleteSelectLine = new ContextmenuItem('deleteLine', 'es.contextmenu.index.DeleteSelectLine')
    .withIcon('Delete')
    .withHideFunc(() => state.selectKeys.length == 0)
    .withOnClick(async () => {
        let ids = state.selectKeys.map((a: any) => a._id);
        await useI18nDeleteConfirm(ids.join(', '));
        await doDeleteDoc(ids);
    });

const dataContextmenuClick = (event: any, rowIndex: number, column: any, data: any) => {
    event.preventDefault();
    const { clientX, clientY } = event;
    state.contextmenu.dropdown.x = clientX;
    state.contextmenu.dropdown.y = clientY;
    state.contextmenu.items = [copyCell, copyLineJson, copySelectLineJson, editLineJson, deleteLine, deleteSelectLine];
    contextmenuRef.value.openContextmenu({ column, rowData: data });
};

// ---- Export ----

const hasCustomQuery = computed(() => {
    const query = state.search.query;
    if (!query) return false;
    const bool = query.bool;
    if (!bool) return Object.keys(query).length > 0;
    return (bool.must?.length > 0) || (bool.should?.length > 0) || (bool.must_not?.length > 0) || ((bool as any).filter?.length > 0);
});

const onOpenExportDialog = () => {
    exportDialog.scope = state.selectKeys.length > 0 ? 'selected' : (hasCustomQuery.value ? 'query' : 'all');
    exportDialog.type = 'csv';
    exportDialog.fields = [...state.fields];
    exportDialog.allFields = true;
    exportDialog.loading = false;
    exportDialog.queryTotal = -1;
    exportDialog.queryTotalLoading = false;
    exportDialog.visible = true;
    if (exportDialog.scope === 'all' || exportDialog.scope === 'query') {
        fetchQueryTotal();
    }
};

const onExportFieldsToggle = () => {
    exportDialog.fields = exportDialog.allFields ? [...state.fields] : [];
};

const onExportFieldsChange = () => {
    exportDialog.allFields = exportDialog.fields.length === state.fields.length;
};

let queryTotalAbort: (() => void) | null = null;
const fetchQueryTotal = async () => {
    if (!currentIdxName.value) return;
    exportDialog.queryTotalLoading = true;
    exportDialog.queryTotal = -1;
    const api = Api.newPost(`/es/instance/proxy/${props.instId}/${currentIdxName.value}/_count`);
    const body = state.search.query ? { query: state.search.query } : {};
    const { execute, data, abort } = api.useApi(body, { esProxyReq: true });
    queryTotalAbort = abort;
    await execute();
    if (data.value && typeof data.value.count === 'number') {
        exportDialog.queryTotal = data.value.count;
    }
    exportDialog.queryTotalLoading = false;
};

watch(
    () => exportDialog.scope,
    (scope) => {
        if (scope === 'all' || scope === 'query') {
            fetchQueryTotal();
        } else {
            if (queryTotalAbort) {
                queryTotalAbort();
                queryTotalAbort = null;
            }
            exportDialog.queryTotal = -1;
            exportDialog.queryTotalLoading = false;
        }
    }
);

const onConfirmExport = async () => {
    exportDialog.loading = true;
    exportDialog.progress = null;
    try {
        if (exportDialog.scope === 'selected' && state.selectKeys.length <= 10000) {
            await exportSelectedData();
        } else {
            await exportAllData();
        }
        exportDialog.visible = false;
    } catch (e: any) {
        Msg.error(e?.message || 'es.export.title');
    } finally {
        exportDialog.loading = false;
        stopProgressPolling();
    }
};

const getExportData = (rows: any[]) => {
    const columns = exportDialog.fields;
    return { rows, columns };
};

const exportSelectedData = async () => {
    const selectedRows = state.selectKeys.length > 0 ? state.selectKeys : state.datas;
    if (!selectedRows || selectedRows.length === 0) {
        Msg.warning('es.export.noData');
        return;
    }

    const { rows, columns } = getExportData(selectedRows);
    const filename = `${currentIdxName.value}-${Date.now()}`;

    switch (exportDialog.type) {
        case 'csv':
            exportCsv(filename, columns, rows as any);
            break;
        case 'excel':
            exportExcel(filename, [{ name: currentIdxName.value, columns, datas: rows }]);
            break;
        case 'json':
            exportFile(`${filename}.json`, JSON.stringify(rows.map((r: any) => {
                const obj: any = {};
                columns.forEach((col: string) => {
                    obj[col] = r[col];
                });
                return obj;
            }), null, 2));
            break;
    }
};

const exportAllData = async () => {
    // Build download URL for backend export
    const exportUrl = esApi.exportData.getUrl().replace('{instanceId}', props.instId);

    // Generate UUID for progress tracking
    const exportId = crypto.randomUUID();

    // If "selected" scope with large dataset, pass selected IDs as ES terms query
    // If "query" scope, pass the current search query
    let searchQuery = null as any;
    if (exportDialog.scope === 'selected' && state.selectKeys.length > 0) {
        searchQuery = {
            query: { terms: { _id: state.selectKeys.map((d: any) => d._id) } },
        };
    } else if (exportDialog.scope === 'query') {
        searchQuery = state.search;
    }

    // Build fields: nil means all, otherwise pass selected fields
    const fields = exportDialog.allFields ? null : exportDialog.fields;

    const body = {
        idxName: currentIdxName.value,
        searchQuery,
        exportType: exportDialog.type,
        fields,
        exportId,
    };

    // Start progress polling
    startProgressPolling(exportId);

    const response = await fetch(exportUrl, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': getToken() || '',
            'ClientId': getClientId() || '',
        },
        body: JSON.stringify(body),
    });

    if (!response.ok) {
        throw new Error(`Export failed: HTTP ${response.status}`);
    }

    const blob = await response.blob();
    const disposition = response.headers.get('Content-Disposition');
    let downloadFilename = `${currentIdxName.value}.zip`;
    if (disposition) {
        const match = disposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
        if (match && match[1]) {
            downloadFilename = match[1].replace(/['"]/g, '');
        }
    }

    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = downloadFilename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
};

const startProgressPolling = (exportId: string) => {
    stopProgressPolling();
    exportDialog.progress = { total: 0, processed: 0, phase: 'querying', done: false };
    exportDialog.progressTimer = setInterval(async () => {
        try {
            const res = await esApi.exportProgress.request({ exportId });
            if (res) {
                exportDialog.progress = res;
                if (res.done) {
                    stopProgressPolling();
                }
            }
        } catch {
            stopProgressPolling();
        }
    }, 1000);
};

const stopProgressPolling = () => {
    if (exportDialog.progressTimer) {
        clearInterval(exportDialog.progressTimer);
        exportDialog.progressTimer = null;
    }
};

// ---- Helpers ----

const getHealthTagType = (health: string) => {
    return health == 'green' ? 'success' : health == 'yellow' ? 'warning' : 'danger';
};

const selectIndex = async (name: string) => {
    if (indices.value.length === 0) {
        await fetchIndices();
    }
    currentIdxName.value = name;
    onIndexChange(name);
};

defineExpose({
    onBasicSearch,
    onRefresh: fetchIndexData,
    fetchIndexData,
    selectIndex,
});
</script>

<style lang="scss">
.es-index-data-box {
    height: 100%;
    display: flex;
    flex-direction: column;
}

.es-op-header {
    padding: 4px 0;
}

.es-table-data {
    overflow: hidden;

    .es-table {
        border-left: var(--el-table-border);
        border-top: var(--el-table-border);
    }

    .es-table-column {
        padding: 0 2px;
        font-size: 12px;
        border-right: var(--el-table-border);
    }

    .header-column-title {
        height: 30px;
        display: flex;
        justify-content: center;
    }

    .table-data-cell {
        width: 100%;
        height: 100%;
        line-height: 30px;
        cursor: pointer;
    }

    .es-row-selected {
        background-color: var(--el-table-current-row-bg-color);
    }

    .es-row-hover:hover {
        background-color: var(--el-fill-color-light);
    }

    .data-selection {
        background-color: var(--el-table-current-row-bg-color);
    }

    .update_field_active {
        background-color: var(--el-color-success-light-3);
    }

    .el-table-v2__overlay {
        z-index: 1;
    }
}

.export-fields-group {
    max-height: 180px;
    overflow-y: auto;
    border: 1px solid var(--el-border-color-lighter);
    border-radius: 4px;
    padding: 8px;

    .el-checkbox {
        display: block;
        margin-right: 0;
        margin-bottom: 4px;
    }
}
</style>
