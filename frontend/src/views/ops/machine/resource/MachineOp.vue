<template>
    <div class="machine-op-manager">
        <el-dialog v-if="infoDialog.visible" v-model="infoDialog.visible">
            <el-descriptions :title="$t('common.detail')" :column="3" border>
                <el-descriptions-item :span="1.5" label="ID">{{ infoDialog.data.id }}</el-descriptions-item>
                <el-descriptions-item :span="1.5" :label="$t('common.name')">{{ infoDialog.data.name }}</el-descriptions-item>

                <el-descriptions-item :span="3" :label="$t('tag.relateTag')">
                    <TagCodePath :path="infoDialog.data.tags" />
                </el-descriptions-item>

                <el-descriptions-item :span="2" label="IP">{{ infoDialog.data.ip }}</el-descriptions-item>
                <el-descriptions-item :span="1" :label="$t('machine.port')">{{ infoDialog.data.port }}</el-descriptions-item>

                <el-descriptions-item :span="3" :label="$t('common.remark')">{{ infoDialog.data.remark }}</el-descriptions-item>

                <el-descriptions-item :span="1.5" :label="$t('machine.sshTunnel')"
                    >{{ infoDialog.data.sshTunnelMachineId > 0 ? $t('common.yes') : $t('common.no') }}
                </el-descriptions-item>
                <el-descriptions-item :span="1.5" :label="$t('machine.terminalPlayback')"
                    >{{ infoDialog.data.enableRecorder == 1 ? $t('common.yes') : $t('common.no') }}
                </el-descriptions-item>

                <el-descriptions-item :span="2" :label="$t('common.createTime')">
                    {{ formatDate(infoDialog.data.createTime) }}
                </el-descriptions-item>
                <el-descriptions-item :span="1" :label="$t('common.creator')">
                    {{ infoDialog.data.creator }}
                </el-descriptions-item>

                <el-descriptions-item :span="2" :label="$t('common.updateTime')">
                    {{ formatDate(infoDialog.data.updateTime) }}
                </el-descriptions-item>
                <el-descriptions-item :span="1" :label="$t('common.modifier')">
                    {{ infoDialog.data.modifier }}
                </el-descriptions-item>
            </el-descriptions>
        </el-dialog>

        <process-list v-model:visible="processDialog.visible" v-model:machineId="processDialog.machineId" />

        <script-manage
            v-if="serviceDialog.machineId"
            :title="serviceDialog.title"
            v-model:visible="serviceDialog.visible"
            v-model:machineId="serviceDialog.machineId"
            :auth-cert-name="serviceDialog.authCertName"
        />

        <file-conf-list
            v-if="fileDialog.machine"
            v-model:visible="fileDialog.visible"
            :machine-id="fileDialog.machine?.id"
            :auth-cert-name="fileDialog.machine?.selectAuthCert?.name"
            :protocol="fileDialog.machine?.protocol"
            :open-file-manager="false"
            @select="onFileConfigSelect"
        />

        <machine-stats v-model:visible="machineStatsDialog.visible" :machineId="machineStatsDialog.machineId" :title="machineStatsDialog.title" />

        <machine-rec v-model:visible="machineRecDialog.visible" :machineId="machineRecDialog.machineId" :title="machineRecDialog.title" />

        <!-- Terminal section (merged from MachineTerminal) -->
        <div v-if="machineRef" class="machine-terminal-wrapper">
            <div class="terminal-body flex-1 min-h-0">
                <TerminalBody
                    v-if="machineRef.protocol == MachineProtocolEnum.Ssh.value"
                    :mount-init="false"
                    @status-change="onStatusChange"
                    ref="terminalRef"
                    :socket-url="socketUrlRef"
                    :machine-id="machineRef.id"
                    :auth-cert-name="authCertRef"
                    :file-id="0"
                    :protocol="machineRef.protocol"
                />
                <machine-rdp
                    v-if="machineRef.protocol != MachineProtocolEnum.Ssh.value"
                    :machine-id="machineRef.id"
                    :auth-cert="authCertRef"
                    :protocol="machineRef.protocol"
                    ref="terminalRef"
                    @status-change="onStatusChange"
                />
            </div>
        </div>
    </div>
</template>

<script lang="ts" setup>
import EnumValue from '@/common/Enum';
import { formatDate } from '@/common/utils/format';
import MachineRdp from '@/components/terminal-rdp/MachineRdp.vue';
import TerminalBody from '@/components/terminal/TerminalBody.vue';
import { TerminalStatus, TerminalStatusEnum } from '@/components/terminal/common';
import { ResourceOpCtx, ResourceComponentConfig } from '@/views/ops/component/tag';
import { MachineFileComp } from '@/views/ops/machine/resource';
import { ResourceOpCtxKey } from '@/views/ops/resource/resource';
import { defineAsyncComponent, getCurrentInstance, inject, nextTick, onMounted, reactive, ref, toRefs } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRouter } from 'vue-router';
import TagCodePath from '../../component/TagCodePath.vue';
import { getMachineTerminalSocketUrl } from '../api';
import { MachineProtocolEnum } from '../enums';

// 组件
const ScriptManage = defineAsyncComponent(() => import('../ScriptManage.vue'));
const FileConfList = defineAsyncComponent(() => import('../file/FileConfList.vue'));
const MachineStats = defineAsyncComponent(() => import('../MachineStats.vue'));
const MachineRec = defineAsyncComponent(() => import('../MachineRec.vue'));
const ProcessList = defineAsyncComponent(() => import('../ProcessList.vue'));
const MachineFile = defineAsyncComponent(() => import('../file/MachineFile.vue'));

// Local self-reference for terminal tab creation (avoids circular dependency with index.ts)
const MachineOpSelf = defineAsyncComponent(() => import('./MachineOp.vue'));

const { t } = useI18n();
const router = useRouter();

const resourceOpCtx: ResourceOpCtx | undefined = inject(ResourceOpCtxKey);

const state = reactive({
    // Terminal status (from MachineTerminal)
    status: TerminalStatusEnum.Disconnected.value,

    infoDialog: {
        visible: false,
        data: null as any,
    },
    serviceDialog: {
        visible: false,
        machineId: 0,
        authCertName: '',
        title: '',
    },
    processDialog: {
        visible: false,
        machineId: 0,
    },
    fileDialog: {
        visible: false,
        machine: null as any,
    },
    machineStatsDialog: {
        visible: false,
        stats: null,
        title: '',
        machineId: 0,
    },
    machineRecDialog: {
        visible: false,
        machineId: 0,
        title: '',
    },
});

const socketUrlRef = ref('');
const authCertRef = ref('');
const machineRef = ref();

const { infoDialog, serviceDialog, processDialog, fileDialog, machineStatsDialog, machineRecDialog } = toRefs(state);

const terminalRef = ref();

const props = defineProps<{
    tabKey?: string;
}>();

const emits = defineEmits(['init']);

onMounted(() => {
    // Init as MachineOp component
    emits('init', { name: 'tag.machineOp', tabKey: props.tabKey, ref: getCurrentInstance()?.exposed });

    // Auto-connect terminal if this instance is a terminal tab
    // if (props.machine?.selectAuthCert) {
    //     nextTick(() => {
    //         handleReconnect();
    //         setTimeout(() => fitTerminal(), 300);
    //     });
    // }
});

// ---- Terminal methods (from MachineTerminal) ----

const onStatusChange = (status: TerminalStatus) => {
    state.status = status;
};

const handleReconnect = () => {
    terminalRef.value?.init?.();
};

const fitTerminal = () => {
    terminalRef.value?.fitTerminal?.();
};

const close = () => {
    terminalRef.value?.close?.();
};

const focus = () => {
    terminalRef.value?.focus?.();
};

const blur = () => {
    terminalRef.value?.blur?.();
};

// ---- Terminal tab creation ----

const openTerminal = (machine: any, ex?: boolean) => {
    const ac = machine.selectAuthCert.name;

    // Open in new window
    if (ex) {
        if (machine.protocol == MachineProtocolEnum.Ssh.value) {
            const { href } = router.resolve({
                path: `/machine/terminal`,
                query: { ac, name: machine.name },
            });
            window.open(href, '_blank');
            return;
        }
        if (machine.protocol == MachineProtocolEnum.Rdp.value) {
            const { href } = router.resolve({
                path: `/machine/terminal-rdp`,
                query: { machineId: machine.id, ac: ac, name: machine.name },
            });
            window.open(href, '_blank');
            return;
        }
    }
    
    socketUrlRef.value = getMachineTerminalSocketUrl(ac)
    machineRef.value = machine;
    authCertRef.value = ac
    nextTick(()=>{
        handleReconnect();
        setTimeout(() => fitTerminal(), 300);
    })
};

// ---- File tab creation ----

const onFileConfigSelect = (fileConfig: { fileId: number; path: string; name: string; type: number }) => {
    const machine = state.fileDialog.machine;
    if (!machine) return;

    const machineId = machine.id;
    const authCertName = machine.selectAuthCert.name;
    const tabKey = `machine_file_${machine.code}_${fileConfig.fileId}`;

    const labelName = `${t('machine.fileTabPrefix')}${machine.selectAuthCert.username}@${machine.name}/${fileConfig.name}`;
    const tabLabel = labelName.length > 25 ? labelName.slice(0, 18) + '...' + labelName.slice(-7) : labelName;

    resourceOpCtx?.addResourceComponent({
        ...MachineFileComp,
        tabKey,
        tabLabel,
        tabProps: {
            tabKey,
            machineId,
            authCertName,
            protocol: machine.protocol,
            fileId: fileConfig.fileId,
            path: fileConfig.path,
        },
    });
};

// ---- Dialog methods ----

const serviceManager = (row: any) => {
    const authCert = row.selectAuthCert;
    state.serviceDialog.machineId = row.id;
    state.serviceDialog.visible = true;
    state.serviceDialog.authCertName = authCert.name;
    state.serviceDialog.title = `${row.name} => ${authCert.username}@${row.ip}`;
};

const showMachineStats = (machine: any) => {
    state.machineStatsDialog.machineId = machine.id;
    state.machineStatsDialog.title = `${t('machine.machineState')}: ${machine.name} => ${machine.ip}`;
    state.machineStatsDialog.visible = true;
};

const showFileManage = (selectionData: any) => {
    state.fileDialog.machine = selectionData;
    state.fileDialog.visible = true;
};

const showInfo = (info: any) => {
    state.infoDialog.data = info;
    state.infoDialog.visible = true;
};

const showProcess = (row: any) => {
    state.processDialog.machineId = row.id;
    state.processDialog.visible = true;
};

const showRec = (row: any) => {
    state.machineRecDialog.title = `${row.name}[${row.ip}]-${t('machine.terminalPlayback')}`;
    state.machineRecDialog.machineId = row.id;
    state.machineRecDialog.visible = true;
};

defineExpose({
    openTerminal,
    showInfo,
    showProcess,
    showRec,
    showMachineStats,
    showFileManage,
    serviceManager,
    // Terminal methods (from MachineTerminal)
    init: handleReconnect,
    onRefresh: handleReconnect,
    close,
    fitTerminal,
    focus,
    blur,
});
</script>

<style lang="scss">
.machine-op-manager {
    height: 100%;
}

.machine-terminal-wrapper {
    height: 100%;
    display: flex;
    flex-direction: column;
}

.terminal-header {
    display: flex;
    align-items: center;
    padding: 2px 8px;
    border-bottom: 1px solid var(--el-border-color-light);
    font-size: 12px;
}

.terminal-info-text {
    cursor: pointer;
}

.terminal-body {
    overflow: hidden;
}
</style>
