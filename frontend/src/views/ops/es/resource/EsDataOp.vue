<template>
    <div class="es-op-manager">
        <es-edit-row v-model="docEditDialog" v-model:visible="docEditDialog.visible" @success="onEditRowSuccess" />
        <es-index-detail ref="esIndexDetailRef" />
        <es-add-index
            v-model:visible="addIndexDialog.visible"
            :instId="addIndexDialog.instId"
            :idxNames="addIndexDialog.idxNames"
            @success="onAddIndexSuccess"
        />
        <es-reindex
            :instId="reIndexDialog.instId"
            :idxName="reIndexDialog.idxName"
            :idxNames="reIndexDialog.idxNames"
            v-model:visible="reIndexDialog.visible"
            @success="onReIndexSuccess"
        />
        <es-index-template :inst-id="templateDialog.instId" :version="templateDialog.version" v-model="templateDialog.visible" />
    </div>
</template>

<script lang="tsx" setup>
import { defineAsyncComponent, getCurrentInstance, inject, onMounted, provide, reactive, ref, toRefs } from 'vue';
import { formatDocSize } from '@/common/utils/format';
import { copyToClipboard } from '@/common/utils/string';
import { Msg, useI18nConfirm, useI18nDeleteConfirm } from '@/hooks/useI18n';
import { ResourceOpCtx, TagTreeNode, ResourceComponentConfig } from '@/views/ops/component/tag';
import { esApi } from '@/views/ops/es/api';
import { EsOpComp, EsIndexDataComp } from '@/views/ops/es/resource';
import { ResourceOpCtxKey } from '@/views/ops/resource/resource';
import { useI18n } from 'vue-i18n';

const EsAddIndex = defineAsyncComponent(() => import('../component/EsAddIndex.vue'));
const EsEditRow = defineAsyncComponent(() => import('../component/EsEditRow.vue'));
const EsIndexDetail = defineAsyncComponent(() => import('../component/EsIndexDetail.vue'));
const EsIndexTemplate = defineAsyncComponent(() => import('../component/EsIndexTemplate.vue'));
const EsReindex = defineAsyncComponent(() => import('../component/EsReindex.vue'));
const EsDashboard = defineAsyncComponent(() => import('../component/EsDashboard.vue'));

const props = defineProps<{
    tabKey?: string;
}>();

const emits = defineEmits(['init']);
const { t } = useI18n();

const perms = {
    saveData: 'es:data:save',
    delData: 'es:data:del',
};

const resourceOpCtx: ResourceOpCtx | undefined = inject(ResourceOpCtxKey);

const state = reactive({
    showSysIndex: false,
    docEditDialog: {
        instId: '',
        isAdd: true,
        loading: false,
        visible: false,
        doc: '',
        idxName: '',
        _id: '',
        _refreshTab: null as (() => void) | null,
    },
    addIndexDialog: {
        instId: '' as any,
        visible: false,
        data: {} as any,
        idxNames: [] as string[],
    },
    reIndexDialog: {
        instId: '' as any,
        idxName: '' as any,
        visible: false,
        idxNames: [] as string[],
    },
    templateDialog: {
        instId: '' as any,
        version: '',
        visible: false,
    },
});

const { docEditDialog, addIndexDialog, reIndexDialog, templateDialog } = toRefs(state);

const esIndexDetailRef = ref();
const instIndicesMap = new Map();

// Track which index tab to refresh after doc edit
let pendingRefreshTab: string | null = null;

// Provide doc edit context for EsIndexData components
provide('esDocEdit', {
    openEdit: (instId: string, idxName: string, src: string, refreshTab?: () => void) => {
        pendingRefreshTab = null;
        state.docEditDialog.isAdd = false;
        state.docEditDialog.instId = instId;
        state.docEditDialog.idxName = idxName;
        state.docEditDialog._refreshTab = refreshTab || null;
        const obj = JSON.parse(src);
        state.docEditDialog._id = obj._id;
        delete obj._id;
        state.docEditDialog.doc = JSON.stringify(obj, null, 2);
        state.docEditDialog.visible = true;
    },
    openAdd: (instId: string, idxName: string, refreshTab?: () => void) => {
        state.docEditDialog.isAdd = true;
        state.docEditDialog.instId = instId;
        state.docEditDialog._id = '';
        state.docEditDialog.idxName = idxName;
        state.docEditDialog._refreshTab = refreshTab || null;
        state.docEditDialog.visible = true;
    },
});

onMounted(() => {
    emits('init', { name: EsOpComp.name, tabKey: props.tabKey, ref: getCurrentInstance()?.exposed });
});

// ---- Index cache management ----

const getIndicesByInstId = async (instId: any) => {
    if (!instIndicesMap.has(instId)) {
        await refreshIndices(instId);
    }
    return instIndicesMap.get(instId);
};

const refreshIndices = async (instId: any) => {
    let indicesRes = await esApi.proxyReq('get', instId, `/_cat/indices/?h=index,health,status,uuid,pri,rep,docs.count,docs.deleted,store.size,sc,cd`);
    instIndicesMap.set(instId, indicesRes);
};

const onRefreshIndices = async (instId: any, key: any) => {
    await refreshIndices(instId);
    reloadNode(key);
};

// ---- Tab creation ----

const openDashboard = (nodeData: TagTreeNode) => {
    const label = `${nodeData.label}`;
    resourceOpCtx?.addResourceComponent({
        ...EsOpComp,
        tabKey: `es_${nodeData.params.id}_dashboard`,
        tabLabel: label,
        component: EsDashboard,
        tabProps: { tabKey: `es_${nodeData.params.id}_dashboard`, instId: nodeData.params.id },
    });
};

const openIndexData = (params: any) => {
    const instId = params.params.inst.id;
    const idxName = params.idxName;
    const tabKey = `es_${instId}_idx_${idxName}`;

    return resourceOpCtx?.addResourceComponent({
        ...EsIndexDataComp,
        tabKey,
        tabLabel: idxName,
        tabProps: {
            tabKey,
            instId,
            idxName,
            params,
        },
    });
};

// ---- Index CRUD operations ----

const onAddIndex = async (data: any) => {
    state.addIndexDialog.data = data;
    state.addIndexDialog.instId = data.params.instId;
    state.addIndexDialog.visible = true;
    let indices = await getIndicesByInstId(data.params.instId);
    state.addIndexDialog.idxNames = indices
        .map((x: any) => x.index)
        .filter((x: any) => x.indexOf('.') < 0)
        .sort();
};

const onAddIndexSuccess = async () => {
    await onRefreshIndices(state.addIndexDialog.data.params.instId, state.addIndexDialog.data.key);
};

const onReIndexSuccess = () => {
    console.log('onReIndexSuccess');
};

const onIdxCopyName = async (data: any) => {
    await copyToClipboard(data.params.idxName);
};

const onRefreshIdx = async (data: any) => {
    await esApi.proxyReq('post', data.params.instId, `/${data.params.idxName}/_refresh`);
    Msg.operateSuccess();
};

const onClearIdxCache = async (data: any) => {
    await useI18nConfirm('es.clearCacheConfirm', { name: data.params.idxName });
    await esApi.proxyReq('post', data.params.instId, `/${data.params.idxName}/_cache/clear`);
    Msg.operateSuccess();
};

const onFlushIdx = async (data: any) => {
    await esApi.proxyReq('post', data.params.instId, `/${data.params.idxName}/_flush`);
    Msg.operateSuccess();
};

const onIdxReindex = async (data: any) => {
    await onReindex(data.params.instId, data.params.idxName);
};

const onIdxClose = async (data: any) => {
    await useI18nConfirm('es.closeIndexConfirm', { name: data.params.idxName });
    await esApi.proxyReq('post', data.params.instId, `/${data.params.idxName}/_close`);
    data.params.idx.status = 'close';
    Msg.operateSuccess();
};

const onIdxOpen = async (data: any) => {
    await useI18nConfirm('es.openIndexConfirm', { name: data.params.idxName });
    await esApi.proxyReq('post', data.params.instId, `/${data.params.idxName}/_open`);
    data.params.idx.status = 'open';
    Msg.operateSuccess();
};

const onIdxDelete = async (data: any) => {
    await useI18nDeleteConfirm(data.params.idxName);
    await esApi.proxyReq('delete', data.params.instId, data.params.idxName);
    Msg.deleteSuccess();
    await onRefreshIndices(data.params.instId, data.params.parentKey);
};

const onIdxBaseSearch = async (data: any) => {
    const params = data.params;
    const ref = await openIndexData(params);
    if (ref) {
        ref.onBasicSearch?.();
    }
};

const onReindex = async (instId: any, idxName: string) => {
    state.reIndexDialog.visible = true;
    state.reIndexDialog.instId = instId;
    state.reIndexDialog.idxName = idxName;
    state.reIndexDialog.visible = true;
    let indices = await getIndicesByInstId(instId);
    state.reIndexDialog.idxNames = indices
        .map((x: any) => x.index)
        .filter((x: any) => x != idxName && x.indexOf('.') < 0)
        .sort();
};

const onIndexDetail = async (data: any) => {
    let param = {
        idxName: data.params.idxName,
        instId: data.params.instId,
    };
    esIndexDetailRef.value.open(param);
};

const onShowSysIndex = (data: any) => {
    state.showSysIndex = true;
    reloadNode(data.key);
};

const onShowTemplate = async (data: any) => {
    state.templateDialog.visible = true;
    state.templateDialog.version = data.params.inst.version;
    state.templateDialog.instId = data.params.instId;
};

const onEditRowSuccess = async () => {
    state.docEditDialog.visible = false;
    if (state.docEditDialog._refreshTab) {
        state.docEditDialog._refreshTab();
        state.docEditDialog._refreshTab = null;
    }
};

const reloadNode = async (nodeKey: string) => {
    resourceOpCtx?.reloadTreeNode(nodeKey);
};

// ---- Load index list for tree ----

const loadIdxs = async (params: any) => {
    let idxNodes = [];
    let indices = {} as any;
    let keys = [] as string[];

    let indicesRes = await getIndicesByInstId(params.instId);
    indicesRes.forEach((x: any) => {
        if (state.showSysIndex) {
            indices[x.index] = x;
            keys.push(x.index);
        } else if (!x.index.startsWith('.') && x.index.indexOf('.') < 0) {
            indices[x.index] = x;
            keys.push(x.index);
        }
    });

    keys = keys.sort();

    for (let idxName of keys) {
        const idx = indices[idxName];
        const key = `es.${params.inst.id}.index.${idxName}`;
        idxNodes.push({
            instId: params.instId,
            idxName,
            idx,
            params,
            key: key,
            size: idx['store.size'],
            docs: formatDocSize(idx['docs.count'] || 0, 1),
        });
    }

    state.showSysIndex = false;
    return idxNodes;
};

// ---- Instance click (open dashboard) ----

const onInstClick = (nodeData: TagTreeNode) => {
    openDashboard(nodeData);
};

defineExpose({
    onInstClick,
    loadIdxs,
    reloadNode,
    onRefreshIndices,
    onAddIndex,
    onShowSysIndex,
    onShowTemplate,
    onIdxClose,
    onIdxOpen,
    onIdxDelete,
    onIdxBaseSearch,
    onIndexDetail,
    onFlushIdx,
    onRefreshIdx,
    onIdxCopyName,
    onClearIdxCache,
    onIdxReindex,
    openIndexData,
    openDashboard,
});
</script>

<style lang="scss">
.es-op-manager {
    height: 100%;
}

.el-drawer__header {
    padding: 0 15px !important;
    height: 50px;
    display: flex;
    align-items: center;
    margin-bottom: 0 !important;
    border-bottom: 1px solid var(--el-border-color);
}
</style>
