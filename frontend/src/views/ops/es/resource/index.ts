import { defineAsyncComponent } from 'vue';
import { ResourceTypeEnum, TagResourceTypeEnum } from '@/common/commonEnum';
import { sleep } from '@/common/utils/loading';
import { ContextmenuItem } from '@/components/contextmenu';
import { esApi } from '@/views/ops/es/api';
import { i18n } from '@/i18n';
import { NodeType, TagTreeNode, ResourceComponentConfig } from '@/views/ops/component/tag';
import { ResourceConfig } from '../../component/tag';

const Icon = {
    name: ResourceTypeEnum.Es.extra.icon,
    color: ResourceTypeEnum.Es.extra.iconColor,
};

const EsInstanceList = defineAsyncComponent(() => import('../EsInstanceList.vue'));
const EsDataOp = defineAsyncComponent(() => import('./EsDataOp.vue'));
const EsIndexData = defineAsyncComponent(() => import('./EsIndexData.vue'));

const NodeEs = defineAsyncComponent(() => import('./NodeEs.vue'));
const NodeEsIndex = defineAsyncComponent(() => import('./NodeEsIndex.vue'));

export const EsOpComp: ResourceComponentConfig = {
    name: 'tag.esDataOp',
    component: EsDataOp,
    icon: Icon,
};

export const EsIndexDataComp: ResourceComponentConfig = {
    name: 'tag.esIndexData',
    component: EsIndexData,
    icon: Icon,
};

// tagpath 节点类型
const NodeTypeEsTag = new NodeType(TagTreeNode.TagPath)
    .withContextMenuItems([
        new ContextmenuItem('refresh', 'common.refresh')
            .withIcon('refresh')
            .withOnClick(async (nodeData: TagTreeNode) => (await nodeData.ctx?.addResourceComponent(EsOpComp)).reloadNode(nodeData.key)),
    ])
    .withLoadNodesFunc(async (parentNode: TagTreeNode) => {
        // 加载es实例列表
        const res = await esApi.instances.request({ tagPath: parentNode.params.tagPath });
        if (!res.total) {
            return [];
        }
        const insts = res.list;
        await sleep(100);
        return insts?.map((x: any) => {
            x.tagPath = parentNode.key;
            return TagTreeNode.new(parentNode, `es.inst.${x.code}`, x.name, NodeTypeInst).withNodeComponent(NodeEs).withIsLeaf(true).withParams(x);
        });
    });

// 加载实例列表
const NodeTypeInst = new NodeType(1)
    .withNodeClickFunc(async (nodeData: TagTreeNode) => {
        // 加载 EsDataOp 单例（不带 tabKey，不创建标签），再由 openDashboard 创建标签
        (await nodeData.ctx?.addResourceComponent(EsOpComp)).onInstClick(nodeData);
    });


export default {
    order: 5,
    resourceType: TagResourceTypeEnum.EsInstance.value,
    rootNodeType: NodeTypeEsTag,
    manager: {
        componentConf: {
            component: EsInstanceList,
            icon: Icon,
            name: 'tag.es',
        },
        countKey: 'es',
        permCode: 'es:instance:save',
    },
} as ResourceConfig;
