package persistence

import (
	"mayfly-go/internal/db/domain/entity"
	"mayfly-go/internal/db/domain/repository"
	"mayfly-go/pkg/biz"
	"mayfly-go/pkg/gormx"
	"mayfly-go/pkg/model"
)

type dbSqlExecRepoImpl struct{}

func newDbSqlExecRepo() repository.DbSqlExec {
	return new(dbSqlExecRepoImpl)
}

func (d *dbSqlExecRepoImpl) Insert(dse *entity.DbSqlExec) {
	gormx.Insert(dse)
}

func (d *dbSqlExecRepoImpl) DeleteBy(condition *entity.DbSqlExec) {
	biz.ErrIsNil(gormx.DeleteByCondition(condition), "删除sql执行记录失败")
}

// 分页获取
func (d *dbSqlExecRepoImpl) GetPageList(condition *entity.DbSqlExec, pageParam *model.PageParam, toEntity any, orderBy ...string) *model.PageResult[any] {
	qd := gormx.NewQuery(condition).WithCondModel(condition).WithOrderBy(orderBy...)
	return gormx.PageQuery(qd, pageParam, toEntity)
}
