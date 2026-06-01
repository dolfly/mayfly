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
                    <el-tooltip :show-after="tooltipTime" effect="dark" placement="top" :teleported="false" :content="t('common.refresh')">
                        <el-link @click="onRefreshData" icon="refresh" underline="never" />
                    </el-tooltip>

                    <el-tooltip :show-after="tooltipTime" effect="dark" placement="top" :teleported="false" :content="t('es.opSearch')">
                        <el-link @click="onBasicSearch" icon="Search" underline="never" />
                    </el-tooltip>

                    <el-tooltip
                        :show-after="tooltipTime"
                        v-auth="perms.saveData"
                        effect="dark"
                        placement="top"
                        :teleported="false"
                        :content="t('common.create')"
                    >
                        <el-link @click="onAddDoc" icon="plus" underline="never" />
                    </el-tooltip>
                    <el-tooltip
                        :show-after="tooltipTime"
                        v-auth="perms.delData"
                        effect="dark"
                        placement="top"
                        :teleported="false"
                        :content="t('common.delete')"
                    >
                        <el-link :disabled="state.selectKeys.length === 0" @click="onDeleteDocs" icon="Minus" underline="never" />
                    </el-tooltip>
                    <el-tooltip :show-after="tooltipTime" v-auth="perms.saveData" effect="dark" placement="top" :teleported="false" :content="t('common.edit')">
                        <el-link :disabled="state.selectKeys.length !== 1" @click="onEditSelectDoc" icon="EditPen" underline="never" />
                    </el-tooltip>
                    <el-tooltip :show-after="tooltipTime" effect="dark" placement="top" :teleported="false" :content="t('es.page.home')">
                        <el-link :disabled="state.search.from === 0" @click="onFirstPage" icon="DArrowLeft" underline="never" />
                    </el-tooltip>
                    <el-tooltip :show-after="tooltipTime" effect="dark" placement="top" :teleported="false" :content="t('es.page.prev')">
                        <el-link :disabled="state.search.from === 0" @click="onPrevPage" icon="ArrowLeft" underline="never" />
                    </el-tooltip>

                    <el-tooltip :show-after="tooltipTime" effect="dark" placement="top" :teleported="false" :content="t('es.page.changeSize')">
                        <el-dropdown placement="bottom" size="small" :teleported="false">
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
                    </el-tooltip>
                    /
                    <el-tooltip :show-after="tooltipTime" effect="dark" placement="top" :teleported="false" :content="t('es.page.total')">
                        <el-link
                            underline="never"
                            @click="onSwitchTrackTotal"
                            :type="state.search.track_total_hits === true ? 'success' : 'info'"
                            :style="{ fontSize: '12px' }"
                        >
                            {{ state.searchRes.hits?.total?.value || 0 }}</el-link
                        >
                    </el-tooltip>
                    <el-tooltip :show-after="tooltipTime" effect="dark" placement="top" :teleported="false" :content="t('es.page.next')">
                        <el-link
                            :disabled="state.search.from + state.search.size >= (state.total || 0)"
                            @click="onNextPage"
                            icon="ArrowRight"
                            underline="never"
                        />
                    </el-tooltip>

                    <el-tooltip :show-after="tooltipTime" effect="dark" placement="top" :teleported="false" :content="t('es.opViewColumns')">
                        <el-dropdown placement="bottom" size="small" :max-height="300" :hide-on-click="false" trigger="click" :teleported="false">
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
                    </el-tooltip>
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
    </div>
</template>

<script lang="tsx" setup>
import Api from '@/common/Api';
import { copyToClipboard } from '@/common/utils/string';
import { Contextmenu, ContextmenuItem } from '@/components/contextmenu';
import SvgIcon from '@/components/svgIcon/index.vue';
import { Msg, useI18nDeleteConfirm } from '@/hooks/useI18n';
import { esApi } from '@/views/ops/es/api';
import { useIntervalFn } from '@vueuse/core';
import { defineAsyncComponent, onMounted, reactive, ref } from 'vue';
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

const state = reactive({
    columns: [] as any[],
    fields: [] as string[],
    datas: [] as any[],
    total: 0,
    searchRes: {} as any,
    rowHeight: 30,
    selectAll: false,
    selectKeys: [] as any[],
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

const onSelectAll = () => {
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
</style>
