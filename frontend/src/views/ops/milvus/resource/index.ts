import { defineAsyncComponent } from 'vue';
import { NodeType, TagTreeNode, ResourceComponentConfig, ResourceConfig } from '../../component/tag';
import { ResourceTypeEnum, TagResourceTypeEnum } from '@/common/commonEnum';
import { sleep } from '@/common/utils/loading';
import { milvusApi, perms } from '@/views/ops/milvus/api';

export const MilvusIcon = {
    name: ResourceTypeEnum.Milvus.extra.icon,
    color: ResourceTypeEnum.Milvus.extra.iconColor,
};

const MilvusList = defineAsyncComponent(() => import('../MilvusList.vue'));
const MilvusOp = defineAsyncComponent(() => import('./MilvusOp.vue'));

const NodeMilvus = defineAsyncComponent(() => import('./NodeMilvus.vue'));
const NodeMilvusAc = defineAsyncComponent(() => import('./NodeMilvusAc.vue'));

export const MilvusOpComp: ResourceComponentConfig = {
    name: 'tag.milvusOp',
    component: MilvusOp,
    icon: MilvusIcon,
};

// milvus 授权凭证节点类型：点击后打开独立标签页
const NodeTypeMilvusAc = new NodeType(TagResourceTypeEnum.Milvus.value * 10 + 1).withNodeClickFunc(async (node: TagTreeNode) => {
    const milvus = node.params;
    const milvusId = milvus.id;
    const acName = milvus.selectAuthCert?.name || '';
    const acUsername = milvus.selectAuthCert?.username;
    // 标签页唯一标识：milvusId + acName，确保不重复创建
    const tabKey = `milvus_${milvusId}_${acName}`;
    // 标签页显示名：milvus实例名 + 用户名（如有）
    const tabLabel = acUsername ? `${milvus.name} (${acUsername})` : milvus.name;

    const compRef = await node.ctx?.addResourceComponent({
        ...MilvusOpComp,
        tabKey,
        tabLabel,
        tabProps: { milvusId, acName, tabKey },
    });
    // 仅在首次创建时初始化（已存在的标签页只是激活，不重置状态）
    compRef?.initMilvus?.(milvus);
});

const NodeTypeMilvus = new NodeType(TagResourceTypeEnum.Milvus.value).withLoadNodesFunc((node: TagTreeNode) => {
    const milvus = node.params;
    const authCerts = milvus.authCerts || [];
    return authCerts.map((x: any) =>
        TagTreeNode.new(node, x.name, x.username, NodeTypeMilvusAc)
            .withNodeComponent(NodeMilvusAc)
            .withParams({ ...milvus, selectAuthCert: x })
            .withIsLeaf(true)
            .withIcon({ name: 'Ticket', color: '#409eff' })
    );
});

// tagpath 节点类型
const NodeTypeMilvusTag = new NodeType(TagTreeNode.TagPath).withLoadNodesFunc(async (parentNode: TagTreeNode) => {
    const tagPath = parentNode.params.tagPath;
    const res = await milvusApi.list.request({ tagPath });
    if (!res.total) {
        return [];
    }
    const milvusInfos = res.list;
    await sleep(100);
    return milvusInfos.map((x: any) => {
        return TagTreeNode.new(parentNode, `${x.code}`, x.name, NodeTypeMilvus).withParams(x).withNodeComponent(NodeMilvus);
    });
});

export default {
    order: 7,
    resourceType: TagResourceTypeEnum.Milvus.value,
    rootNodeType: NodeTypeMilvusTag,
    manager: {
        componentConf: {
            component: MilvusList,
            icon: MilvusIcon,
            name: 'milvus',
        },
        countKey: 'milvus',
        permCode: perms.base,
    },
} as ResourceConfig;
