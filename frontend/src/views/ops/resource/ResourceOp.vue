<template>
    <div class="h-full" :class="{ 'resource-op-fullscreen': isFullscreen }">
        <el-splitter @resize="onResizeOpPanel">
            <el-splitter-panel size="24%" max="40%">
                <el-card class="h-full flex" body-class="!p-0 flex flex-col w-full">
                    <div class="tag-tree-header flex justify-between items-center">
                        <el-input v-model="filterText" :placeholder="$t('tag.tagFilterPlaceholder')" clearable size="small" class="tag-tree-search w-full">
                            <template #prefix>
                                <SvgIcon class="tag-tree-search-icon" name="search" />
                            </template>
                        </el-input>

                        <div class="ml-1" v-if="singletonCount > 1">
                            <el-dropdown placement="bottom-start" @command="changeResourceOp">
                                <el-button type="primary" link plain><SvgIcon name="Switch" /> </el-button>

                                <template #dropdown>
                                    <el-dropdown-menu>
                                        <el-dropdown-item
                                            :command="{ name }"
                                            v-for="(compConf, name) in singletonComponents"
                                            :key="name"
                                            :disabled="name == activeResourceCompName"
                                        >
                                            <SvgIcon v-if="compConf.icon" :name="compConf.icon.name" :color="compConf.icon.color" />
                                            <div class="ml-1">{{ compConf.tabLabel || $t(compConf.name) }}</div>
                                        </el-dropdown-item>
                                    </el-dropdown-menu>
                                </template>
                            </el-dropdown>
                        </div>
                    </div>

                    <el-scrollbar>
                        <el-tree
                            class="min-w-full inline-block"
                            ref="treeRef"
                            :highlight-current="true"
                            :indent="10"
                            :load="loadNode"
                            :props="treeProps"
                            lazy
                            node-key="key"
                            :expand-on-click-node="false"
                            :filter-node-method="filterNode"
                            @node-click="treeNodeClick"
                            @node-expand="treeNodeClick"
                            @node-contextmenu="onNodeContextmenu"
                            :default-expanded-keys="state.defaultExpandedKeys"
                        >
                            <template #default="{ node, data }">
                                <div class="select-none" v-if="data.type == TagResourceTypeEnum.Tag.value">
                                    <span v-for="(value, i) in data.label.split('/')" :key="i">
                                        <el-text class="mr-[1.5px]! ml-[1.5px]!" v-if="i != 0" tag="b" type="primary" size="large">/</el-text>
                                        <el-text>{{ value }}</el-text>
                                    </span>
                                </div>

                                <component v-else-if="data.nodeComponent" :is="data.nodeComponent" :node="node" :data="data" />
                                <BaseTreeNode v-else :node="node" :data="data" />
                            </template>
                        </el-tree>
                    </el-scrollbar>
                </el-card>
            </el-splitter-panel>

            <el-splitter-panel>
                <el-card class="h-full" body-class="h-full !p-1 flex flex-col flex-1">
                    <!-- 标签栏：当存在带 tabKey 的组件时显示 -->
                    <div v-if="resourceTabs.length > 0" class="resource-tabs">
                        <div
                            v-for="tab in resourceTabs"
                            :key="tab.tabKey"
                            class="resource-tab-item"
                            :class="{ 'is-active': activeResourceCompName === tab.tabKey }"
                            @click="activateTab(tab.tabKey)"
                            @contextmenu.prevent="onTabContextmenu($event, tab)"
                        >
                            <SvgIcon v-if="tab.icon" :name="tab.icon.name" :color="tab.icon.color" class="resource-tab-icon" />
                            <span class="resource-tab-label" :title="tab.tabLabel || $t(tab.name)">{{ tab.tabLabel || $t(tab.name) }}</span>
                            <span class="resource-tab-actions">
                                <SvgIcon name="RefreshRight" class="resource-tab-action" @click.stop="refreshTab(tab.tabKey)" />
                                <span class="resource-tab-action" @click.stop="closeTab(tab.tabKey)">
                                    <SvgIcon name="Close" class="text-[12px]!" />
                                </span>
                                <span class="resource-tab-fullscreen" @click.stop="toggleFullscreen">
                                    <SvgIcon v-if="!isFullscreen" name="FullScreen" class="resource-tab-action" />
                                    <SvgIcon v-else name="crop" class="resource-tab-action" />
                                </span>
                            </span>
                        </div>
                    </div>
                    <div class="resource-tab-content">
                        <keep-alive>
                            <component
                                :is="resourceComponents[activeResourceCompName]?.component"
                                :key="componentKey"
                                v-bind="resourceComponents[activeResourceCompName]?.tabProps"
                                @init="initResourceComp"
                            />
                        </keep-alive>
                    </div>
                </el-card>
            </el-splitter-panel>
        </el-splitter>

        <Contextmenu :dropdown="state.dropdown" :items="state.contextmenuItems" ref="contextmenuRef" />
        <Contextmenu :dropdown="tabDropdown" :items="tabContextmenuItems" ref="tabContextmenuRef" />
    </div>
</template>

<script lang="ts" setup>
import { computed, markRaw, nextTick, onMounted, onUnmounted, provide, reactive, ref, toRefs, useTemplateRef, watch } from 'vue';

import { Contextmenu, ContextmenuItem } from '@/components/contextmenu';
import { isPrefixSubsequence } from '@/common/utils/string';
import SvgIcon from '@/components/svgIcon/index.vue';
import { TagResourceTypeEnum } from '@/common/commonEnum';
import EnumValue from '@/common/Enum';
import { getResourceNodeType, getResourceTypes, ResourceOpCtxKey, loadResourceTags } from './resource';
import BaseTreeNode from './BaseTreeNode.vue';
import { tagApi } from '@/views/ops/tag/api';
import { TagTreeNode, ResourceComponentConfig, ResourceOpCtx } from '@/views/ops/component/tag';
import { useI18n } from 'vue-i18n';
import { useAutoOpenResource } from '@/store/autoOpenResource';
import { storeToRefs } from 'pinia';

const props = defineProps({
    load: {
        type: Function,
        required: false,
    },
    loadContextmenuItems: {
        type: Function,
        required: false,
    },
});

const treeProps = {
    label: 'name',
    children: 'zones',
    isLeaf: 'isLeaf',
};

const autoOpenResourceStore = useAutoOpenResource();
const { autoOpenResource } = storeToRefs(autoOpenResourceStore);

const { t } = useI18n();

const emit = defineEmits(['nodeClick', 'currentContextmenuClick']);

const treeRef: any = useTemplateRef('treeRef');
const contextmenuRef: any = useTemplateRef('contextmenuRef');
const tabContextmenuRef: any = useTemplateRef('tabContextmenuRef');

// 存储所有注册的资源组件引用，key -> 组件名称
const resourceComponents = ref<Record<string, ResourceComponentConfig>>({});

// 存储当前组件对应的最后操作的节点key，用户切换资源操作组件时，定位到相应的树节点
const resourceComponentsNodeKey = ref<Record<string, string>>({});

// 当前激活（正在操作）的资源组件
const activeResourceCompName = ref<string>('');

// 带 tabKey 的标签页列表
const resourceTabs = ref<ResourceComponentConfig[]>([]);

const resourceComponentRefs = ref<Record<string, any>>({});

// tab key 版本号，关闭时递增以强制清除 keep-alive 缓存
const tabKeyVersions = ref<Record<string, number>>({});
const componentKey = computed(() => {
    const name = activeResourceCompName.value;
    return name ? `${name}-${tabKeyVersions.value[name] || 0}` : '';
});

// Tab 右键菜单
const tabDropdown = reactive({ x: 0, y: 0 });
const tabContextmenuItems = ref<ContextmenuItem[]>([]);

const cmTabCloseAll = new ContextmenuItem('closeAll', 'layout.tagsView.closeAll').withIcon('Close').withOnClick(() => closeAllTabs());

const cmTabCloseLeft = new ContextmenuItem('closeLeft', 'layout.tagsView.closeLeft').withIcon('Back').withOnClick((data: any) => closeLeftTabs(data.tabKey));

const cmTabCloseRight = new ContextmenuItem('closeRight', 'layout.tagsView.closeRight')
    .withIcon('Right')
    .withOnClick((data: any) => closeRightTabs(data.tabKey));

const cmTabCloseOther = new ContextmenuItem('closeOther', 'layout.tagsView.closeOther')
    .withIcon('Switch')
    .withOnClick((data: any) => closeOtherTabs(data.tabKey));

tabContextmenuItems.value = [cmTabCloseLeft, cmTabCloseRight, cmTabCloseOther, cmTabCloseAll];

// 右侧面板全屏相关
const isFullscreen = ref(false);

const toggleFullscreen = () => {
    isFullscreen.value = !isFullscreen.value;
};

const onFullscreenKeydown = (e: KeyboardEvent) => {
    if (e.key === 'Escape' && isFullscreen.value) {
        isFullscreen.value = false;
    }
};

onMounted(() => {
    document.addEventListener('keydown', onFullscreenKeydown);
});

onUnmounted(() => {
    document.removeEventListener('keydown', onFullscreenKeydown);
});

// :ref="(el: any) => setResourceComponentRefs(activeResourceComp, el)"
const setResourceComponentRefs = async (name: string, ref: any) => {
    if (!name || !ref) {
        return;
    }
    if (resourceComponentRefs.value[name]) {
        return;
    }
    resourceComponentRefs.value[name] = ref;
};

const state = reactive({
    defaultExpandedKeys: [] as string[],
    filterText: '',
    contextmenuItems: [],
    dropdown: {
        x: 0,
        y: 0,
    },
});

const { filterText } = toRefs(state);

watch(filterText, (val) => {
    treeRef.value?.filter(val);
});

watch(
    () => autoOpenResource.value.codePath,
    (autoOpenCodePath: any) => {
        if (!autoOpenCodePath) {
            return;
        }

        const expandedKeys: string[] = [];
        let currentTagPath = '';
        const parts = autoOpenCodePath.split('/'); // 切分字符串并保留数字和对应的值部分
        let addResouceType = false;
        for (let part of parts) {
            if (!part) {
                continue;
            }
            let [key, value] = part.split('|'); // 分割数字和值部分
            // 如果不存在第二个参数，则说明为标签类型
            if (!value) {
                const tagPath = key + '/';
                currentTagPath = currentTagPath + tagPath;
                expandedKeys.push(currentTagPath);
                continue;
            }
            if (!addResouceType) {
                expandedKeys.push(currentTagPath + '-' + key);
                expandedKeys.push(value);
                addResouceType = true;
            } else {
                expandedKeys.push(value);
            }
        }

        state.defaultExpandedKeys = expandedKeys;
        autoOpenResourceStore.setCodePath('');
        setTimeout(() => {
            setCurrentKey(expandedKeys[expandedKeys.length - 1]);
        }, 500);
    },
    { immediate: true }
);

const filterNode = (value: string, data: any) => {
    return !value || isPrefixSubsequence(value, data.label);
};

/**
 * 加载树节点
 * @param { Object } node
 * @param { Object } resolve
 */
const loadNode = async (node: any, resolve: (data: any) => void, reject: () => void) => {
    if (typeof resolve !== 'function') {
        return;
    }
    let nodes;
    try {
        if (node.level == 0) {
            nodes = await loadResourceTags(getResourceTypes(), ctx);
        } else if (props.load) {
            nodes = await props.load(node);
        } else {
            nodes = await node.data.loadChildren();
        }
    } catch (e: any) {
        console.error(e);
        // 调用 reject 以保持节点状态，并允许远程加载继续。
        return reject();
    }
    return resolve(nodes);
};

let lastNodeClickTime = 0;

const treeNodeClick = async (data: any, node: any) => {
    // 关闭可能存在的右击菜单
    contextmenuRef.value?.closeContextmenu();

    const currentClickNodeTime = Date.now();
    // 双击节点
    if (currentClickNodeTime - lastNodeClickTime < 300) {
        await treeNodeDblclick(data, node);
    } else {
        lastNodeClickTime = currentClickNodeTime;
        if (!data.disabled && !data.type.nodeDblclickFunc && data.type.nodeClickFunc) {
            emit('nodeClick', data);
            await data.type.nodeClickFunc(data);
        }
    }

    setTimeout(() => {
        if (activeResourceCompName.value) {
            resourceComponentsNodeKey.value[activeResourceCompName.value] = data.key;
        }
    }, 500);
};

// 树节点双击事件
const treeNodeDblclick = async (data: any, node: any) => {
    if (node.expanded) {
        node.collapse();
    } else {
        node.expand();
    }

    if (!data.disabled && data.type.nodeDblclickFunc) {
        await data.type.nodeDblclickFunc(data);
    }
};

// 树节点右击事件
const onNodeContextmenu = (event: any, data: any) => {
    if (data.disabled) {
        return;
    }

    // 加载当前节点是否需要显示右击菜单
    let items = data.type.contextMenuItems;
    if (!items || items.length == 0) {
        if (props.loadContextmenuItems) {
            items = props.loadContextmenuItems(data);
        }
    }
    if (!items) {
        return;
    }
    state.contextmenuItems = items;
    const { clientX, clientY } = event;
    state.dropdown.x = clientX;
    state.dropdown.y = clientY;
    contextmenuRef.value.openContextmenu(data);
};

// 初始化资源组件ref
const initResourceComp = (val: any) => {
    // tabbed 组件使用 tabKey 作为 ref 键，单例组件使用 name
    const key = val.tabKey || val.name;
    if (!val.ref || resourceComponentRefs.value[key]) {
        return;
    }
    resourceComponentRefs.value[key] = val.ref;
};

// 单例组件（不含 tabKey 的组件），用于下拉切换
const singletonComponents = computed(() => {
    const result: Record<string, ResourceComponentConfig> = {};
    for (const [key, val] of Object.entries(resourceComponents.value)) {
        if (!val.tabKey) {
            result[key] = val;
        }
    }
    return result;
});

const singletonCount = computed(() => Object.keys(singletonComponents.value).length);

const addResourceComponent = async (componentConf: ResourceComponentConfig) => {
    const tabKey = componentConf.tabKey;
    // 带 tabKey 时使用 tabKey 作为字典键，否则回退到 name（单例模式）
    const compKey = tabKey || componentConf.name;

    if (!resourceComponents.value[compKey]) {
        // 将 tabKey 注入到 tabProps，确保子组件能通过 props 接收到
        if (tabKey) {
            componentConf.tabProps = { ...componentConf.tabProps, tabKey };
        }
        resourceComponents.value[compKey] = componentConf;
    }

    // 如果是带 tabKey 的组件，管理标签页列表
    if (tabKey) {
        const existingTabIndex = resourceTabs.value.findIndex((t) => t.tabKey === tabKey);
        if (existingTabIndex === -1) {
            resourceTabs.value.push({ ...componentConf, component: undefined });
        }
    }

    activeResourceCompName.value = compKey;

    // 组件切换后，通知新激活的组件（用于同步全局状态等）
    nextTick(() => {
        const activeRef = resourceComponentRefs.value[compKey];
        activeRef?.onActivate?.();
    });

    // 使用一个 Promise 来确保组件引用已经被设置
    return new Promise((resolve) => {
        const checkRef = () => {
            if (resourceComponentRefs.value[compKey]) {
                resolve(resourceComponentRefs.value[compKey]);
            } else {
                // 如果引用还没有设置，稍后再检查
                setTimeout(checkRef, 10);
            }
        };
        // 先等待 nextTick 确保 DOM 更新
        nextTick().then(() => {
            checkRef();
        });
    });
};

const changeResourceOp = (data: any) => {
    const compName = data.name;
    activeResourceCompName.value = compName;
    if (resourceComponentsNodeKey.value[compName]) {
        setCurrentKey(resourceComponentsNodeKey.value[compName]);
    }
};

// 激活指定标签页
const activateTab = (tabKey: string) => {
    activeResourceCompName.value = tabKey;
    // 定位到左侧资源树对应节点
    if (resourceComponentsNodeKey.value[tabKey]) {
        setCurrentKey(resourceComponentsNodeKey.value[tabKey]);
    }
    nextTick(() => {
        const activeRef = resourceComponentRefs.value[tabKey];
        activeRef?.onActivate?.();
    });
};

// 关闭标签页
const closeTab = (tabKey: string) => {
    const tabIndex = resourceTabs.value.findIndex((t) => t.tabKey === tabKey);
    if (tabIndex === -1) return;

    // 移除标签
    resourceTabs.value.splice(tabIndex, 1);
    delete resourceComponents.value[tabKey];
    delete resourceComponentRefs.value[tabKey];
    tabKeyVersions.value[tabKey] = (tabKeyVersions.value[tabKey] || 0) + 1;

    // 如果关闭的是当前活动标签，切换到相邻标签
    if (activeResourceCompName.value === tabKey) {
        if (resourceTabs.value.length > 0) {
            const nextTab = resourceTabs.value[Math.min(tabIndex, resourceTabs.value.length - 1)];
            activateTab(nextTab.tabKey!);
        } else {
            // 没有标签了，清空活动组件
            activeResourceCompName.value = '';
        }
    }
};

// 刷新标签页（通过改变 key 强制重新渲染）
const refreshTab = (tabKey: string) => {
    const compRef = resourceComponentRefs.value[tabKey];
    if (compRef?.onRefresh) {
        compRef.onRefresh();
        return;
    }
    // // 回退方案：移除组件引用并重新创建
    // delete resourceComponentRefs.value[tabKey];
    // if (resourceComponents.value[tabKey]) {
    //     const originalComponent = resourceComponents.value[tabKey].component;
    //     // 临时设为 null 触发组件销毁，然后恢复
    //     resourceComponents.value[tabKey] = { ...resourceComponents.value[tabKey], component: null as any };
    //     nextTick(() => {
    //         if (resourceComponents.value[tabKey]) {
    //             resourceComponents.value[tabKey] = {
    //                 ...resourceComponents.value[tabKey],
    //                 component: markRaw(originalComponent),
    //             };
    //         }
    //     });
    // }
};

// Tab 右键菜单处理
const onTabContextmenu = (event: MouseEvent, tab: ResourceComponentConfig) => {
    // 关闭可能存在的树节点右键菜单
    contextmenuRef.value?.closeContextmenu();
    tabDropdown.x = event.clientX;
    tabDropdown.y = event.clientY;
    tabContextmenuRef.value?.openContextmenu({ tabKey: tab.tabKey });
};

// 关闭所有标签
const closeAllTabs = () => {
    const allKeys = resourceTabs.value.map((t) => t.tabKey!);
    allKeys.forEach((key) => {
        delete resourceComponents.value[key];
        delete resourceComponentRefs.value[key];
        tabKeyVersions.value[key] = (tabKeyVersions.value[key] || 0) + 1;
    });
    resourceTabs.value = [];
    activeResourceCompName.value = '';
};

// 关闭左侧标签
const closeLeftTabs = (targetTabKey: string) => {
    const targetIndex = resourceTabs.value.findIndex((t) => t.tabKey === targetTabKey);
    if (targetIndex <= 0) return;
    const tabsToClose = resourceTabs.value.slice(0, targetIndex);
    tabsToClose.forEach((tab) => {
        delete resourceComponents.value[tab.tabKey!];
        delete resourceComponentRefs.value[tab.tabKey!];
        tabKeyVersions.value[tab.tabKey!] = (tabKeyVersions.value[tab.tabKey!] || 0) + 1;
    });
    resourceTabs.value = resourceTabs.value.slice(targetIndex);
    // 如果当前激活的标签被关闭，切换到目标标签
    if (tabsToClose.some((t) => t.tabKey === activeResourceCompName.value)) {
        activateTab(targetTabKey);
    }
};

// 关闭其他标签
const closeOtherTabs = (targetTabKey: string) => {
    const tabsToClose = resourceTabs.value.filter((t) => t.tabKey !== targetTabKey);
    tabsToClose.forEach((tab) => {
        delete resourceComponents.value[tab.tabKey!];
        delete resourceComponentRefs.value[tab.tabKey!];
        tabKeyVersions.value[tab.tabKey!] = (tabKeyVersions.value[tab.tabKey!] || 0) + 1;
    });
    resourceTabs.value = resourceTabs.value.filter((t) => t.tabKey === targetTabKey);
    activateTab(targetTabKey);
};

// 关闭右侧标签
const closeRightTabs = (targetTabKey: string) => {
    const targetIndex = resourceTabs.value.findIndex((t) => t.tabKey === targetTabKey);
    if (targetIndex === -1 || targetIndex === resourceTabs.value.length - 1) return;
    const tabsToClose = resourceTabs.value.slice(targetIndex + 1);
    tabsToClose.forEach((tab) => {
        delete resourceComponents.value[tab.tabKey!];
        delete resourceComponentRefs.value[tab.tabKey!];
        tabKeyVersions.value[tab.tabKey!] = (tabKeyVersions.value[tab.tabKey!] || 0) + 1;
    });
    resourceTabs.value = resourceTabs.value.slice(0, targetIndex + 1);
    // 如果当前激活的标签被关闭，切换到目标标签
    if (tabsToClose.some((t) => t.tabKey === activeResourceCompName.value)) {
        activateTab(targetTabKey);
    }
};

const reloadNode = (nodeKey: any) => {
    let node = getNode(nodeKey);
    node.loaded = false;
    node.expand();
};

const getNode = (nodeKey: any) => {
    let node = treeRef.value.getNode(nodeKey);
    if (!node) {
        throw new Error('未找到节点: ' + nodeKey);
    }
    return node;
};

const setCurrentKey = (nodeKey: any) => {
    treeRef.value.setCurrentKey(nodeKey);

    // 通过Id获取到对应的dom元素
    const node = document.getElementById(nodeKey);
    if (node) {
        setTimeout(() => {
            nextTick(() => {
                // 通过scrollIntoView方法将对应的dom元素定位到可见区域 【block: 'center'】这个属性是在垂直方向居中显示
                node.scrollIntoView({ block: 'center' });
            });
        }, 100);
    }
};

const onResizeOpPanel = () => {
    for (let name in resourceComponentRefs.value) {
        resourceComponentRefs.value[name]?.onResize?.();
    }
};

const ctx: ResourceOpCtx = {
    addResourceComponent,
    setCurrentTreeKey: setCurrentKey,
    getTreeNode: getNode,
    reloadTreeNode: reloadNode,
};

provide(ResourceOpCtxKey, ctx);
</script>

<style lang="scss" scoped>
.tag-tree-header {
    padding: 4px 6px;
    border-bottom: 1px solid var(--el-border-color-light);
}

.tag-tree-search {
    :deep(.el-input__wrapper) {
        border-radius: 14px;
        height: 24px;
    }
}

.resource-tab-content {
    flex: 1;
    min-height: 0;
    overflow: hidden;
}

.resource-tabs {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 2px 4px;
    border-bottom: 1px solid var(--el-border-color-light);
    flex-shrink: 0;
    overflow-x: auto;
    min-height: 32px;

    &::-webkit-scrollbar {
        height: 3px;
    }
}

.resource-tab-item {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 2px 8px;
    border-radius: 4px;
    cursor: pointer;
    font-size: 12px;
    white-space: nowrap;
    color: var(--el-text-color-regular);
    background-color: var(--el-fill-color-blank);
    border: 1px solid var(--el-border-color-lighter);
    transition: all 0.2s ease;
    flex-shrink: 0;

    &:hover {
        background-color: var(--el-fill-color);
        color: var(--el-text-color-primary);
    }

    &.is-active {
        color: var(--el-color-primary);
        background-color: var(--el-color-primary-light-9);
        border-color: var(--el-color-primary-light-5);
    }
}

.resource-tab-icon {
    font-size: 12px;
    flex-shrink: 0;
}

.resource-tab-label {
    max-width: 140px;
    overflow: hidden;
    text-overflow: ellipsis;
}

.resource-tab-actions {
    display: none;
    align-items: center;
    gap: 2px;
    flex-shrink: 0;
    margin-left: 2px;

    .resource-tab-item.is-active &,
    .resource-tab-item:hover & {
        display: flex;
    }
}

.resource-tab-action {
    font-size: 12px;
    width: 16px;
    height: 16px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 3px;
    flex-shrink: 0;
    color: var(--el-text-color-secondary);
    transition: all 0.2s ease;

    &:hover {
        background-color: var(--el-color-info-light-7);
        color: var(--el-text-color-primary);
    }
}

.resource-tab-item.is-active .resource-tab-action:hover {
    background-color: var(--el-color-primary);
    color: var(--el-color-white);
}

.resource-tab-fullscreen {
    margin-left: auto;
    display: flex;
    align-items: center;
    flex-shrink: 0;
    cursor: pointer;
}
</style>

<style lang="scss">
.resource-op-fullscreen {
    position: fixed !important;
    inset: 0;
    z-index: 2000;
    background: var(--el-bg-color);
}
</style>
