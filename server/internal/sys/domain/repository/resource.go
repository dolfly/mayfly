package repository

import (
	"mayfly-go/internal/sys/domain/entity"
)

type Resource interface {
	// 获取资源列表
	GetResourceList(condition *entity.Resource, toEntity any, orderBy ...string)

	GetById(id uint64, cols ...string) *entity.Resource

	Delete(id uint64)

	GetByCondition(condition *entity.Resource, cols ...string) error

	// 获取账号资源列表
	GetAccountResources(accountId uint64, toEntity any)

	// 获取所有子节点id
	GetChildren(uiPath string) []entity.Resource

	// 根据uiPath右匹配更新所有相关类资源
	UpdateByUiPathLike(resource *entity.Resource)
}
