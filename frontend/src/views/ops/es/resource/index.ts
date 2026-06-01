import { ResourceTypeEnum, TagResourceTypeEnum } from '@/common/commonEnum';
import { sleep } from '@/common/utils/loading';
import { NodeType, TagTreeNode } from '@/views/ops/component/tag';
import { esApi } from '@/views/ops/es/api';
import type { ResourceConfig } from '@/views/ops/resource/resource';
import { createResourceOpTab } from '@/views/ops/resource/resourceOp';
import { defineAsyncComponent } from 'vue';

const Icon = {
    name: ResourceTypeEnum.Es.extra.icon,
    color: ResourceTypeEnum.Es.extra.iconColor,
};

const EsInstanceList = defineAsyncComponent(() => import('../EsInstanceList.vue'));
const EsDashboard = defineAsyncComponent(() => import('../component/EsDashboard.vue'));

const NodeEs = defineAsyncComponent(() => import('./NodeEs.vue'));

// tagpath 节点类型
const NodeTypeEsTag = new NodeType(TagTreeNode.TagPath).withLoadNodesFunc(async (parentNode: TagTreeNode) => {
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
const NodeTypeInst = new NodeType(1).withNodeClickFunc(async (nodeData: TagTreeNode) => {
    const inst = nodeData.params;
    const tabKey = `es_${inst.id}`;
    createResourceOpTab({
        key: tabKey,
        name: inst.name,
        component: EsDashboard,
        componentProps: {
            instId: inst.id,
        },
        tabComponentProps: { icon: Icon },
    });
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
