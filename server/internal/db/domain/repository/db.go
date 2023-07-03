package repository

import (
	"mayfly-go/internal/db/domain/entity"
	"mayfly-go/pkg/model"
)

type Db interface {
	// 分页获取机器信息列表
	GetDbList(condition *entity.DbQuery, pageParam *model.PageParam, toEntity any, orderBy ...string) *model.PageResult[any]

	Count(condition *entity.DbQuery) int64

	// 根据条件获取账号信息
	GetDb(condition *entity.Db, cols ...string) error

	// 根据id获取
	GetById(id uint64, cols ...string) *entity.Db

	Insert(db *entity.Db)

	Update(db *entity.Db)

	Delete(id uint64)
}
