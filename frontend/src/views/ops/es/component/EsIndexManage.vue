<template>
    <div class="es-index-manage-box">
        <div class="es-idx-toolbar flex-shrink-0">
            <el-space>
                <el-button type="primary" icon="Plus" size="small" @click="onAddIndex">{{ t('es.addIndex') }}</el-button>
                <el-button icon="Refresh" size="small" @click="fetchIndices">{{ t('common.refresh') }}</el-button>
                <el-button type="primary" size="small" @click="templateVisible = true">{{ t('es.templates') }}</el-button>
                <el-checkbox v-model="showSysIndex" size="small" @change="fetchIndices">{{ t('es.contextmenu.index.showSys') }}</el-checkbox>
            </el-space>
        </div>
        <div class="es-idx-table">
            <el-auto-resizer>
                <template #default="{ height, width }">
                    <el-table
                        :data="filteredIndices"
                        v-loading="loading"
                        stripe
                        size="small"
                        :height="height"
                        :width="width"
                        @sort-change="onSortChange"
                        :default-sort="{ prop: 'index', order: 'ascending' }"
                    >
            <el-table-column prop="index" :label="t('es.indexName')" min-width="200" sortable="custom" show-overflow-tooltip>
                <template #default="{ row }">
                    <el-link type="primary" :underline="false" @click="emit('viewData', row.index)">{{ row.index }}</el-link>
                </template>
            </el-table-column>
            <el-table-column :label="t('es.aliases')" min-width="180">
                <template #default="{ row }">
                    <el-space wrap :size="4">
                        <el-tag
                            v-for="alias in (aliasesMap[row.index] || [])"
                            :key="alias"
                            closable
                            size="small"
                            type="info"
                            @close="onRemoveAlias(row.index, alias)"
                        >{{ alias }}</el-tag>
                        <el-button link type="primary" size="small" @click="onAddAlias(row)">
                            <el-icon><Plus /></el-icon>
                        </el-button>
                    </el-space>
                </template>
            </el-table-column>
            <el-table-column prop="health" :label="t('es.health')" width="100" sortable="custom" align="center">
                <template #default="{ row }">
                    <el-tag size="small" :type="getHealthTagType(row.health)">{{ row.health }}</el-tag>
                </template>
            </el-table-column>
            <el-table-column prop="status" :label="t('es.status')" width="100" sortable="custom" align="center">
                <template #default="{ row }">
                    <el-tag size="small" :type="row.status === 'open' ? 'success' : 'danger'">{{ row.status }}</el-tag>
                </template>
            </el-table-column>
            <el-table-column prop="pri" label="pri" width="70" align="center" />
            <el-table-column prop="rep" label="rep" width="70" align="center" />
            <el-table-column prop="docs.count" :label="t('es.docs')" width="120" sortable="custom" align="right">
                <template #default="{ row }">{{ row['docs.count'] ?? '-' }}</template>
            </el-table-column>
            <el-table-column prop="store.size" :label="t('es.size')" width="120" sortable="custom" align="right" />
            <el-table-column :label="t('common.operation')" width="260" fixed="right" align="center">
                <template #default="{ row }">
                    <el-button link type="primary" size="small" @click="onViewDetail(row)">{{ t('es.indexDetail') }}</el-button>
                    <el-dropdown trigger="click" @command="(cmd: string) => onRowCommand(cmd, row)">
                        <el-button link type="primary" size="small">
                            {{ t('common.more') }}<el-icon class="el-icon--right"><ArrowDown /></el-icon>
                        </el-button>
                        <template #dropdown>
                            <el-dropdown-menu>
                                <el-dropdown-item command="copyName" :icon="CopyDocument">{{ t('es.contextmenu.index.copyName') }}</el-dropdown-item>
                                <el-dropdown-item command="refresh" :icon="Refresh">{{ t('es.contextmenu.index.refresh') }}</el-dropdown-item>
                                <el-dropdown-item command="flush" :icon="Refresh">{{ t('es.contextmenu.index.flush') }}</el-dropdown-item>
                                <el-dropdown-item command="clearCache" :icon="Refresh">{{ t('es.contextmenu.index.clearCache') }}</el-dropdown-item>
                                <el-dropdown-item command="reindex" :icon="Switch">{{ t('es.Reindex') }}</el-dropdown-item>
                                <el-dropdown-item v-if="row.status === 'open'" command="close" :icon="Close">{{ t('es.contextmenu.index.Close') }}</el-dropdown-item>
                                <el-dropdown-item v-else command="open" :icon="Select">{{ t('es.contextmenu.index.Open') }}</el-dropdown-item>
                                <el-dropdown-item command="delete" :icon="Delete" divided>{{ t('common.delete') }}</el-dropdown-item>
                            </el-dropdown-menu>
                        </template>
                    </el-dropdown>
                </template>
            </el-table-column>
                    </el-table>
                </template>
            </el-auto-resizer>
        </div>

        <!-- 查看/编辑 Mapping 对话框 -->
        <el-drawer v-model="mappingDrawer.visible" :title="`${t('es.indexMapping')} - ${mappingDrawer.idxName}`" size="55%" :append-to-body="false" :destroy-on-close="false">
            <el-auto-resizer>
                <template #default="{ height, width }">
                    <monaco-editor v-model="mappingDrawer.content" language="json" :height="height - 60 + 'px'" :width="width + 'px'" :options="{ tabSize: 2, readOnly: !mappingDrawer.editable }" />
                </template>
            </el-auto-resizer>
            <template #footer>
                <el-space>
                    <el-button @click="mappingDrawer.editable = !mappingDrawer.editable">
                        {{ mappingDrawer.editable ? t('common.cancel') : t('common.edit') }}
                    </el-button>
                    <el-button v-if="mappingDrawer.editable" type="primary" @click="onSaveMapping" :loading="mappingDrawer.saving">{{ t('common.save') }}</el-button>
                </el-space>
            </template>
        </el-drawer>

        <!-- 添加索引对话框 -->
        <EsAddIndex :instId="props.instId" :idxNames="idxNames" v-model:visible="addIndexVisible" @success="fetchIndices" />

        <!-- 索引迁移对话框 -->
        <EsReindex
            :instId="reindexState.instId"
            :idxName="reindexState.idxName"
            :idxNames="reindexState.idxNames"
            v-model:visible="reindexState.visible"
            @success="fetchIndices"
        />

        <!-- 索引详情 -->
        <EsIndexDetail ref="esIndexDetailRef" />

        <!-- 索引模板管理 -->
        <EsIndexTemplate :instId="props.instId" :version="esVersion" v-model="templateVisible" />

        <!-- 添加别名对话框 -->
        <el-dialog v-model="aliasDialog.visible" :title="t('es.addAlias')" width="400" :append-to-body="false">
            <el-form @submit.prevent="onSubmitAddAlias">
                <el-form-item :label="t('es.aliases')">
                    <el-input v-model="aliasDialog.name" autocomplete="off" />
                </el-form-item>
            </el-form>
            <template #footer>
                <el-button @click="aliasDialog.visible = false">{{ t('common.cancel') }}</el-button>
                <el-button type="primary" @click="onSubmitAddAlias" :loading="aliasDialog.loading">{{ t('common.confirm') }}</el-button>
            </template>
        </el-dialog>
    </div>
</template>

<script setup lang="ts">
import { computed, defineAsyncComponent, onMounted, reactive, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { ArrowDown, Close, CopyDocument, Delete, Plus, Refresh, Select, Switch } from '@element-plus/icons-vue';
import { esApi } from '@/views/ops/es/api';
import { copyToClipboard } from '@/common/utils/string';
import { Msg, useI18nConfirm, useI18nDeleteConfirm } from '@/hooks/useI18n';

const MonacoEditor = defineAsyncComponent(() => import('@/components/monaco/MonacoEditor.vue'));
const EsAddIndex = defineAsyncComponent(() => import('./EsAddIndex.vue'));
const EsReindex = defineAsyncComponent(() => import('./EsReindex.vue'));
const EsIndexDetail = defineAsyncComponent(() => import('./EsIndexDetail.vue'));
const EsIndexTemplate = defineAsyncComponent(() => import('./EsIndexTemplate.vue'));

const { t } = useI18n();

const props = defineProps<{
    instId: any;
}>();

const loading = ref(false);
const showSysIndex = ref(false);
const indices = ref<any[]>([]);
const aliasesMap = reactive<Record<string, string[]>>({});
const sortProp = ref('index');
const sortOrder = ref<'ascending' | 'descending'>('ascending');

const addIndexVisible = ref(false);
const templateVisible = ref(false);
const esVersion = ref('');

const emit = defineEmits(['viewData']);

const esIndexDetailRef = ref();

const aliasDialog = reactive({
    visible: false,
    idxName: '',
    name: '',
    loading: false,
});

const reindexState = reactive({
    instId: '' as any,
    idxName: '',
    visible: false,
    idxNames: [] as string[],
});

const mappingDrawer = reactive({
    visible: false,
    idxName: '',
    content: '',
    editable: false,
    saving: false,
});

const idxNames = computed(() => indices.value.map((idx: any) => idx.index).filter((n: string) => !n.startsWith('.')));

const filteredIndices = computed(() => {
    const data = [...indices.value];
    if (!sortProp.value) return data;
    const prop = sortProp.value;
    const dir = sortOrder.value === 'ascending' ? 1 : -1;
    return data.sort((a, b) => {
        const va = a[prop] ?? '';
        const vb = b[prop] ?? '';
        if (typeof va === 'number' && typeof vb === 'number') return (va - vb) * dir;
        return String(va).localeCompare(String(vb)) * dir;
    });
});

onMounted(() => {
    fetchIndices();
    fetchVersion();
});

const fetchVersion = async () => {
    try {
        const res = await esApi.proxyReq('get', props.instId, '/');
        esVersion.value = res?.version?.number || '';
    } catch {
        // non-critical
    }
};

const fetchIndices = async () => {
    loading.value = true;
    try {
        const res = await esApi.proxyReq(
            'get',
            props.instId,
            `/_cat/indices/?h=index,health,status,uuid,pri,rep,docs.count,docs.deleted,store.size,sc,cd`
        );
        const list = res || [];
        indices.value = showSysIndex.value ? list : list.filter((idx: any) => !idx.index.startsWith('.'));
        // Fetch aliases for all indices
        await fetchAliases();
    } finally {
        loading.value = false;
    }
};

const fetchAliases = async () => {
    try {
        const res = await esApi.proxyReq('get', props.instId, '/_alias');
        // Clear and rebuild
        for (const key of Object.keys(aliasesMap)) {
            delete aliasesMap[key];
        }
        for (const idxName of Object.keys(res || {})) {
            const aliases = Object.keys(res[idxName]?.aliases || {});
            if (aliases.length > 0) {
                aliasesMap[idxName] = aliases;
            }
        }
    } catch {
        // Alias fetch failure is non-critical
    }
};

const onSortChange = ({ prop, order }: any) => {
    sortProp.value = prop || 'index';
    sortOrder.value = order === 'descending' ? 'descending' : 'ascending';
};

const onAddIndex = () => {
    addIndexVisible.value = true;
};

const getHealthTagType = (health: string) => {
    return health == 'green' ? 'success' : health == 'yellow' ? 'warning' : 'danger';
};

// ---- Index operations ----

const onRowCommand = async (cmd: string, row: any) => {
    switch (cmd) {
        case 'copyName':
            await copyToClipboard(row.index);
            break;
        case 'refresh':
            await esApi.proxyReq('post', props.instId, `/${row.index}/_refresh`);
            Msg.operateSuccess();
            break;
        case 'mapping':
            await onViewMapping(row);
            break;
        case 'flush':
            await onFlushIndex(row);
            break;
        case 'clearCache':
            await onClearCache(row);
            break;
        case 'reindex':
            onReindex(row);
            break;
        case 'close':
            await onCloseIndex(row);
            break;
        case 'open':
            await onOpenIndex(row);
            break;
        case 'delete':
            await onDeleteIndex(row);
            break;
    }
};

const onViewDetail = (row: any) => {
    esIndexDetailRef.value?.open({ idxName: row.index, instId: props.instId });
};

const onReindex = async (row: any) => {
    reindexState.instId = props.instId;
    reindexState.idxName = row.index;
    reindexState.idxNames = idxNames.value.filter((n: string) => n !== row.index);
    reindexState.visible = true;
};

const onViewMapping = async (row: any) => {
    const res = await esApi.proxyReq('get', props.instId, `/${row.index}/_mappings`);
    mappingDrawer.idxName = row.index;
    mappingDrawer.content = JSON.stringify(res[row.index]?.mappings || {}, null, 2);
    mappingDrawer.editable = false;
    mappingDrawer.saving = false;
    mappingDrawer.visible = true;
};

const onSaveMapping = async () => {
    mappingDrawer.saving = true;
    try {
        await esApi.proxyReq('put', props.instId, `/${mappingDrawer.idxName}/_mappings`, JSON.parse(mappingDrawer.content));
        Msg.saveSuccess();
        mappingDrawer.editable = false;
    } finally {
        mappingDrawer.saving = false;
    }
};

const onCloseIndex = async (row: any) => {
    await useI18nConfirm('es.closeIndexConfirm', { name: row.index });
    await esApi.proxyReq('post', props.instId, `/${row.index}/_close`);
    row.status = 'close';
    Msg.operateSuccess();
};

const onOpenIndex = async (row: any) => {
    await useI18nConfirm('es.openIndexConfirm', { name: row.index });
    await esApi.proxyReq('post', props.instId, `/${row.index}/_open`);
    row.status = 'open';
    Msg.operateSuccess();
};

const onFlushIndex = async (row: any) => {
    await esApi.proxyReq('post', props.instId, `/${row.index}/_flush`);
    Msg.operateSuccess();
};

const onClearCache = async (row: any) => {
    await useI18nConfirm('es.clearCacheConfirm', { name: row.index });
    await esApi.proxyReq('post', props.instId, `/${row.index}/_cache/clear`);
    Msg.operateSuccess();
};

const onDeleteIndex = async (row: any) => {
    await useI18nDeleteConfirm(row.index);
    await esApi.proxyReq('delete', props.instId, row.index);
    Msg.deleteSuccess();
    await fetchIndices();
};

// ---- Alias operations ----

const onAddAlias = (row: any) => {
    aliasDialog.idxName = row.index;
    aliasDialog.name = '';
    aliasDialog.loading = false;
    aliasDialog.visible = true;
};

const onSubmitAddAlias = async () => {
    if (!aliasDialog.name) return;
    aliasDialog.loading = true;
    try {
        await esApi.proxyReq('put', props.instId, `/${aliasDialog.idxName}/_alias/${aliasDialog.name}`);
        Msg.saveSuccess();
        // Update local aliases
        if (!aliasesMap[aliasDialog.idxName]) {
            aliasesMap[aliasDialog.idxName] = [];
        }
        aliasesMap[aliasDialog.idxName].push(aliasDialog.name);
        aliasDialog.visible = false;
    } finally {
        aliasDialog.loading = false;
    }
};

const onRemoveAlias = async (idxName: string, alias: string) => {
    await useI18nDeleteConfirm(`${t('es.aliases')}: ${alias}`);
    await esApi.proxyReq('delete', props.instId, `/${idxName}/_alias/${alias}`);
    Msg.deleteSuccess();
    // Update local aliases
    if (aliasesMap[idxName]) {
        aliasesMap[idxName] = aliasesMap[idxName].filter((a: string) => a !== alias);
    }
};
</script>

<style scoped lang="scss">
.es-index-manage-box {
    height: 100%;
    display: flex;
    flex-direction: column;
}

.es-idx-toolbar {
    padding: 6px 8px;
    border-bottom: 1px solid var(--el-border-color-light);
}

.es-idx-table {
    flex: 1;
    min-height: 0;
}

</style>
