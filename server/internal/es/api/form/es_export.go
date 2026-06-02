package form

type EsExportForm struct {
	IdxName     string   `json:"idxName" binding:"required"`
	SearchQuery any      `json:"searchQuery"`                   // ES search query body (optional, defaults to match_all)
	ExportType  string   `json:"exportType" binding:"required"` // csv, excel, json
	Fields      []string `json:"fields"`                        // fields to export (optional, nil means all)
	ExportId    string   `json:"exportId"`                      // UUID for progress tracking (optional)
}
