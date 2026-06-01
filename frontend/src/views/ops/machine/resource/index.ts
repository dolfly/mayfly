import { ResourceTypeEnum } from '@/common/commonEnum';
import { ContextmenuItem } from '@/components/contextmenu';
import router from '@/router';
import { NodeType, TagTreeNode } from '@/views/ops/component/tag';
import { machineApi } from '@/views/ops/machine/api';
import { MachineProtocolEnum } from '@/views/ops/machine/enums';
import type { ResourceConfig } from '@/views/ops/resource/resource';
import { defineAsyncComponent } from 'vue';
import { createResourceOpTab, showResourceOpOverlay } from '../../resource/resourceOp';

const MachineList = defineAsyncComponent(() => import('../MachineList.vue'));
const TerminalTab = defineAsyncComponent(() => import('./tabs/TerminalTab.vue'));
const TerminalTabLabel = defineAsyncComponent(() => import('./tabs/TerminalTabLabel.vue'));
const FileTab = defineAsyncComponent(() => import('./tabs/FileTab.vue'));
const ScriptManage = defineAsyncComponent(() => import('../ScriptManage.vue'));
const MachineDetailDialog = defineAsyncComponent(() => import('./tabs/MachineDetailDialog.vue'));
const MachineStats = defineAsyncComponent(() => import('../MachineStats.vue'));
const ProcessList = defineAsyncComponent(() => import('../ProcessList.vue'));
const MachineRec = defineAsyncComponent(() => import('../MachineRec.vue'));
const NodeMachineAc = defineAsyncComponent(() => import('./NodeMachineAc.vue'));

const MachineIcon = {
    name: ResourceTypeEnum.Machine.extra.icon,
    color: ResourceTypeEnum.Machine.extra.iconColor,
};

const FileIcon = { name: 'FolderOpened', color: '#E6A23C' };

export const NodeTypeMachineTag = new NodeType(TagTreeNode.TagPath).withLoadNodesFunc(async (node: TagTreeNode) => {
    const res = await machineApi.list.request({ tagPath: node.params.tagPath });
    return res?.list
        .sort((a: any, b: any) => a.name.localeCompare(b.name))
        .map((x: any) =>
            TagTreeNode.new(node, x.code, x.name, NodeTypeMachine)
                .withParams(x)
                .withDisabled(x.status == -1 && x.protocol == MachineProtocolEnum.Ssh.value)
                .withIcon(MachineIcon)
        );
});

export const NodeTypeMachine = new NodeType(11)
    .withLoadNodesFunc((node: TagTreeNode) => {
        const machine = node.params;
        const authCerts = machine.authCerts;
        return authCerts.map((x: any) =>
            TagTreeNode.new(node, x.name, x.username, NodeTypeAuthCert)
                .withNodeComponent(NodeMachineAc)
                .withParams({ ...machine, selectAuthCert: x })
                .withDisabled(machine.status == -1 && machine.protocol == MachineProtocolEnum.Ssh.value)
                .withIcon({
                    name: 'Ticket',
                    color: '#409eff',
                })
                .withIsLeaf(true)
        );
    })
    .withContextMenuItems([
        new ContextmenuItem('detail', 'common.detail').withIcon('More').withOnClick(async (node: TagTreeNode) => {
            const m = node.params;

            // 显示机器详情弹窗（已存在则更新 props，否则注册）
            showResourceOpOverlay('machine_detail', MachineDetailDialog, {
                code: m.code,
            });
        }),

        new ContextmenuItem('status', 'common.status')
            .withIcon('Compass')
            .withHideFunc((node: any) => node.params.protocol != MachineProtocolEnum.Ssh.value)
            .withOnClick(async (node: TagTreeNode) => {
                const m = node.params;

                // 显示机器状态弹窗
                showResourceOpOverlay('machine_stats', MachineStats, {
                    machineId: m.id,
                    title: `${m.name} => ${m.ip}`,
                });
            }),

        new ContextmenuItem('process', 'machine.process')
            .withIcon('DataLine')
            .withHideFunc((node: any) => node.params.protocol != MachineProtocolEnum.Ssh.value)
            .withOnClick(async (node: TagTreeNode) => {
                const m = node.params;

                // 显示进程列表弹窗
                showResourceOpOverlay('machine_process', ProcessList, {
                    machineId: m.id,
                    title: `${m.name} => ${m.ip}`,
                });
            }),

        new ContextmenuItem('edit', 'machine.terminalPlayback')
            .withIcon('Compass')
            .withOnClick(async (node: TagTreeNode) => {
                const m = node.params;

                showResourceOpOverlay('machine_rec', MachineRec, {
                    machineId: m.id,
                    title: `${m.name} => ${m.ip}`,
                });
            })
            .withHideFunc((node: any) => node.params.enableRecorder == 1),
    ]);

export const NodeTypeAuthCert = new NodeType(12)
    .withNodeDblclickFunc(async (node: TagTreeNode) => {
        const m = node.params;

        const key = `machine_term_${m.code}_${m.selectAuthCert.name}_${new Date().getTime()}`;
        createResourceOpTab({
            key,
            name: `${m.selectAuthCert.username}@${m.name}`,

            component: TerminalTab,
            componentProps: {
                tabKey: key,
                machineId: m.id,
                authCertName: m.selectAuthCert.name,
                protocol: m.protocol,
            },

            tabComponent: TerminalTabLabel,
            tabComponentProps: {
                icon: MachineIcon,
                status: 'disconnected',
            },
        });
    })
    .withContextMenuItems([
        new ContextmenuItem('term', 'machine.openTerminal')
            .withIcon('Monitor')
            .withPermission('machine:terminal')
            .withOnClick(async (node: TagTreeNode) => {
                const m = node.params;

                const key = `machine_term_${m.code}_${m.selectAuthCert.name}_${new Date().getTime()}`;
                createResourceOpTab({
                    key,
                    name: `${m.selectAuthCert.username}@${m.name}`,
                    component: TerminalTab,
                    tabComponent: TerminalTabLabel,
                    tabComponentProps: {
                        icon: MachineIcon,
                        status: 'disconnected',
                    },
                    componentProps: {
                        tabKey: key,
                        machineId: m.id,
                        authCertName: m.selectAuthCert.name,
                        protocol: m.protocol,
                    },
                });
            }),
        new ContextmenuItem('term-ex', 'machine.newTabOpenTerminal')
            .withIcon('Monitor')
            .withPermission('machine:terminal')
            .withOnClick(async (node: TagTreeNode) => {
                const machine = node.params;
                const ac = machine.selectAuthCert.name;

                if (machine.protocol == MachineProtocolEnum.Ssh.value) {
                    const { href } = router.resolve({
                        path: `/machine/terminal`,
                        query: {
                            ac,
                            name: machine.name,
                        },
                    });
                    window.open(href, '_blank');
                    return;
                }
                if (machine.protocol == MachineProtocolEnum.Rdp.value) {
                    const { href } = router.resolve({
                        path: `/machine/terminal-rdp`,
                        query: {
                            machineId: machine.id,
                            ac: ac,
                            name: machine.name,
                        },
                    });
                    window.open(href, '_blank');
                    return;
                }
            }),
        new ContextmenuItem('files', 'machine.fileManage').withIcon('FolderOpened').withOnClick(async (node: any) => {
            const m = node.params;

            // 直接打开文件管理 tab，FileTab 内部会处理配置选择
            createResourceOpTab({
                key: `machine_file_${m.code}`,
                name: `${m.selectAuthCert.username}@${m.name}`,
                component: FileTab,
                tabComponentProps: {
                    icon: FileIcon,
                },
                componentProps: {
                    tabKey: `machine_file_${m.code}`,
                    machineId: m.id,
                    authCertName: m.selectAuthCert.name,
                    protocol: m.protocol,
                },
            });
        }),

        new ContextmenuItem('scripts', 'machine.scriptManage')
            .withIcon('Files')
            .withHideFunc((node: any) => node.params.protocol != MachineProtocolEnum.Ssh.value)
            .withOnClick(async (node: any) => {
                const m = node.params;

                // 显示脚本管理弹窗（已存在则更新 props，否则注册）
                showResourceOpOverlay('script_manage', ScriptManage, {
                    machineId: m.id,
                    authCertName: m.selectAuthCert.name,
                    title: `${m.name} => ${m.selectAuthCert.username}@${m.ip}`,
                });
            }),
    ]);

export default {
    order: 1,
    resourceType: ResourceTypeEnum.Machine.value,
    rootNodeType: NodeTypeMachineTag,
    manager: {
        componentConf: {
            component: MachineList,
            icon: MachineIcon,
            name: 'tag.machine',
        },
        permCode: 'machine',
        countKey: 'machine',
    },
} as ResourceConfig;
