package ginx

import (
	"io"
	"mayfly-go/pkg/biz"
	"mayfly-go/pkg/global"
	"mayfly-go/pkg/model"
	"net/http"
	"runtime/debug"
	"strconv"

	"github.com/gin-gonic/gin"
)

// 绑定并校验请求结构体参数
func BindJsonAndValid(g *gin.Context, data any) {
	if err := g.ShouldBindJSON(data); err != nil {
		panic(biz.NewBizErr(err.Error()))
	}
}

// 绑定查询字符串到
func BindQuery(g *gin.Context, data any) {
	if err := g.ShouldBindQuery(data); err != nil {
		panic(biz.NewBizErr(err.Error()))
	}
}

// 获取分页参数
func GetPageParam(g *gin.Context) *model.PageParam {
	return &model.PageParam{PageNum: QueryInt(g, "pageNum", 1), PageSize: QueryInt(g, "pageSize", 10)}
}

// 获取查询参数，不存在则返回默认值
func Query(g *gin.Context, qm string, defaultStr string) string {
	qv := g.Query(qm)
	if qv == "" {
		return defaultStr
	}
	return qv
}

// 获取查询参数中指定参数值，并转为int
func QueryInt(g *gin.Context, qm string, defaultInt int) int {
	qv := g.Query(qm)
	if qv == "" {
		return defaultInt
	}
	qvi, err := strconv.Atoi(qv)
	biz.ErrIsNil(err, "query param not int")
	return qvi
}

// 获取路径参数
func PathParamInt(g *gin.Context, pm string) int {
	value, err := strconv.Atoi(g.Param(pm))
	biz.ErrIsNilAppendErr(err, "string类型转换int异常: %s")
	return value
}

// 获取路径参数
func PathParam(g *gin.Context, pm string) string {
	return g.Param(pm)
}

// 文件下载
func Download(g *gin.Context, reader io.Reader, filename string) {
	g.Header("Content-Type", "application/octet-stream")
	g.Header("Content-Disposition", "attachment; filename="+filename)
	io.Copy(g.Writer, reader)
}

// 返回统一成功结果
func SuccessRes(g *gin.Context, data any) {
	g.JSON(http.StatusOK, model.Success(data))
}

// 返回失败结果集
func ErrorRes(g *gin.Context, err any) {
	switch t := err.(type) {
	case biz.BizError:
		g.JSON(http.StatusOK, model.Error(t))
	case error:
		g.JSON(http.StatusOK, model.ServerError())
		global.Log.Errorf("%s\n%s", t.Error(), string(debug.Stack()))
	case string:
		g.JSON(http.StatusOK, model.ServerError())
		global.Log.Errorf("%s\n%s", t, string(debug.Stack()))
	default:
		global.Log.Error(t)
	}
}
