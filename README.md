# GitHub代理服务

## 项目概述

这是一个基于Cloudflare Workers的GitHub代理服务，允许通过替代域名访问GitHub资源，解决某些网络环境下GitHub访问受限的问题。代理服务通过域名映射和资源转发，提供无缝的GitHub浏览体验。

## 特性

- **子域名匹配系统**：使用 `gh.` 前缀作为GitHub主站的代理入口，支持任何域名后缀
- **完整的资源映射**：支持GitHub相关的所有主要域名，包括API、静态资源、用户内容等
- **内容替换**：自动替换响应中的所有域名引用，确保链接正常工作
- **路径修复**：解决嵌套URL路径问题，特别针对仓库提交信息等特殊路径
- **安全重定向**：对敏感路径（如登录页面）进行安全重定向
- **HTTPS强制**：自动将HTTP请求升级为HTTPS

## 支持的域名映射

服务支持以下GitHub相关域名的代理访问：

- github.com → gh.[您的域名]
- avatars.githubusercontent.com → avatars-githubusercontent-com-gh.[您的域名]
- github.githubassets.com → github-githubassets-com-gh.[您的域名]
- api.github.com → api-github-com-gh.[您的域名]
- raw.githubusercontent.com → raw-githubusercontent-com-gh.[您的域名]
- 以及更多GitHub相关服务域名

## 部署指南

### 前提条件

- Cloudflare账户
- 已配置的域名（托管在Cloudflare上）
- 基本的DNS配置知识

### 部署步骤

1. **登录Cloudflare控制台**
   - 进入Workers部分

2. **创建新的Worker**
   - 点击"创建Worker"
   - 将提供的代码粘贴到代码编辑器中
   - 给Worker命名并保存

3. **配置对应其他资源的域名映射**
   - 更改域名映射配置，将所有相关域名指向您的Worker路由
   - 将 `github.com` 指向您的Worker路由域名 `gh.您的域名`
   - 将 `avatars.githubusercontent.com` 等其他资源指向您的Worker路由域名 `avatars-githubusercontent-com-gh.您的域名`

4. **配置DNS记录**
   - 为您的泛域名添加任何命中CDN的记录
   - 例如 `*.您的域名` A记录指向任何IP并开启代理

5. **配置Worker路由**
   - 添加路由 `*-gh.您的域名/*` 和 `gh.您的域名/*` 指向您的Worker

### 配置自定义域名

如果您想使用不同的域名前缀（仅github.com主站），请修改代码中的`domain_mappings`对象，将默认的`gh.`等前缀替换为您喜欢的前缀。

## 使用方法

部署成功后，只需将原始GitHub URL中的域名部分替换为对应的代理域名：

```
# 原始URL
https://github.com/用户名/仓库名

# 代理URL
https://gh.您的域名/用户名/仓库名
```

其他GitHub资源的访问方式类似，系统会自动处理域名映射和内容替换。

## 技术说明

### 工作原理

1. 接收对代理域名的请求
2. 识别目标GitHub域名
3. 转发请求到GitHub服务器
4. 接收GitHub的响应
5. 替换响应内容中的域名引用
6. 返回修改后的响应给用户

### 特殊路径处理

代码包含专门的逻辑来处理特殊路径，特别是用于仓库提交信息的路径，解决了嵌套URL问题：

```
/用户名/仓库名/latest-commit/分支名/https://gh.域名/...
```

这类路径会被正确截断并转发到GitHub。

## 安全考虑

- 代理服务不存储或处理用户凭据
- 敏感路径（如登录页面）会被重定向到其他网站
- 所有流量都通过HTTPS加密

## 限制

- 不支持GitHub的登录和注册功能
- 某些高级GitHub功能可能不完全兼容
- 不能代替GitHub CLI或Git等工具的直接连接

## 故障排除

如果遇到问题：

1. 确认DNS记录配置正确
2. 检查Worker是否正常运行
3. 尝试清除浏览器缓存
4. 检查请求和响应日志以获取详细错误信息

## 贡献指南

欢迎提交Pull Request或Issue来改进此项目。特别欢迎以下方面的贡献：

- 增加对更多GitHub相关域名的支持
- 改进内容替换逻辑
- 增强错误处理机制
- 添加性能优化

## 免责声明

此代理服务仅用于教育和研究目的。使用者应确保遵守GitHub的服务条款和当地法律法规。
