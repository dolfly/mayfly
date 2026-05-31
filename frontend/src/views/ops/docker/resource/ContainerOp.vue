<template>
    <div class="card h-full flex flex-col">
        <el-tabs v-model="activeName" @tab-change="handleTabChange" class="container-op-tabs">
            <el-tab-pane :label="$t('docker.container')" :name="containerTab">
                <ContainerList :id="containerConfId" />
            </el-tab-pane>

            <el-tab-pane :label="$t('docker.image')" :name="imageTab">
                <ImageList v-if="activeName == imageTab" :id="containerConfId" />
            </el-tab-pane>
        </el-tabs>
    </div>
</template>
<script lang="ts" setup>
import { ContainerOpComp } from '@/views/ops/docker/resource';
import { toRefs, reactive, onMounted, defineAsyncComponent, ref, getCurrentInstance } from 'vue';

const ContainerList = defineAsyncComponent(() => import('../container/ContainerList.vue'));
const ImageList = defineAsyncComponent(() => import('../image/ImageList.vue'));

const props = defineProps<{
    containerId?: number;
    tabKey?: string;
}>();

const emits = defineEmits(['init']);

const containerTab = 'containerTab';
const imageTab = 'imageTab';

const containerConfId = ref<number>(props.containerId || 0);

const state = reactive({
    activeName: containerTab,
    cmdConfs: [],
});

const { activeName } = toRefs(state);

onMounted(async () => {
    emits('init', { name: ContainerOpComp.name, tabKey: props.tabKey, ref: getCurrentInstance()?.exposed });
    state.activeName = containerTab;
});

const handleTabChange = (tabName: any) => {};

defineExpose({
    init: function (id: number) {
        containerConfId.value = id;
    },
});
</script>

<style lang="scss" scoped>
.container-op-tabs {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;

    :deep(.el-tabs__content) {
        flex: 1;
        min-height: 0;
        overflow: visible;
    }

    :deep(.el-tab-pane) {
        height: 100%;
    }
}
</style>
