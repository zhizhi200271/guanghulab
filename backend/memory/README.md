# M-MEMORY 人格体自用云盘存储

## API 接口清单

### 文件上传
`POST /api/memory/upload`
- FormData: file, category, description(可选), tags(可选,逗号分隔)
- 限制: 单文件 ≤50MB, 类型: json/txt/md/csv/log/png/jpg

### 文件列表
`GET /api/memory/files`

### 单文件信息
`GET /api/memory/files/:id`

### 下载文件
`GET /api/memory/files/:id/download`

### 删除文件
`DELETE /api/memory/files/:id`

### 分类统计
`GET /api/memory/categories`

### 按分类查询
`GET /api/memory/categories/:category`

### 关键词搜索
`GET /api/memory/search?q=keyword`

### 更新元数据
`PUT /api/memory/files/:id/meta`
- Body: { "description": "新描述", "tags": ["tag1","tag2"] }

### 配额查询
`GET /api/memory/quota`