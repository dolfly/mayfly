<template>
    <div class="machine-script-tab h-full">
        <ScriptManage 
            :machine-id="machineId" 
            :auth-cert-name="authCertName" 
            :title="title" 
            v-model:visible="dialogVisible"
        />
    </div>
</template>

<script lang="ts" setup>
import { ref, onMounted, onActivated, watch } from 'vue';
import ScriptManage from '@/views/ops/machine/ScriptManage.vue';

const props = defineProps<{
    tabKey?: string;
    machineId: number;
    authCertName: string;
    title?: string;
}>();

// 控制 dialog 显示
const dialogVisible = ref(false);

// 组件挂载时打开 dialog
onMounted(() => {
    dialogVisible.value = true;
});

// keep-alive 激活时也打开 dialog
onActivated(() => {
    dialogVisible.value = true;
});
</script>

<style lang="scss">
.machine-script-tab {
    height: 100%;
    overflow: hidden;
}
</style>
