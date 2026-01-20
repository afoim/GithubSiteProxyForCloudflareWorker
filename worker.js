// 域名映射配置
const domain_mappings = {
  'github.com': 'gh.',
  'avatars.githubusercontent.com': 'avatars-githubusercontent-com-',
  'github.githubassets.com': 'github-githubassets-com-',
  'collector.github.com': 'collector-github-com-',
  'api.github.com': 'api-github-com-',
  'raw.githubusercontent.com': 'raw-githubusercontent-com-',
  'gist.githubusercontent.com': 'gist-githubusercontent-com-',
  'github.io': 'github-io-',
  'assets-cdn.github.com': 'assets-cdn-github-com-',
  'cdn.jsdelivr.net': 'cdn.jsdelivr-net-',
  'securitylab.github.com': 'securitylab-github-com-',
  'www.githubstatus.com': 'www-githubstatus-com-',
  'npmjs.com': 'npmjs-com-',
  'git-lfs.github.com': 'git-lfs-github-com-',
  'githubusercontent.com': 'githubusercontent-com-',
  'github.global.ssl.fastly.net': 'github-global-ssl-fastly-net-',
  'api.npms.io': 'api-npms-io-',
  'github.community': 'github-community-'
};

// 需要重定向的路径
const redirect_paths = ['/', '/login', '/signup', '/copilot'];

addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request));
});

async function handleRequest(request) {
  const url = new URL(request.url);
  // 统一转小写
  const current_host = url.host.toLowerCase();
  const host_header = request.headers.get('Host');
  const effective_host = (host_header || current_host).toLowerCase();
  
  // 检查特殊路径重定向
  if (redirect_paths.includes(url.pathname)) {
    return Response.redirect('https://www.gov.cn', 302);
  }

  // 强制使用 HTTPS
  if (url.protocol === 'http:') {
    url.protocol = 'https:';
    return Response.redirect(url.href);
  }

  // 从有效主机名中提取前缀
  const host_prefix = getProxyPrefix(effective_host);
  if (!host_prefix) {
    return new Response(`Domain not configured for proxy. Host: ${effective_host}, Prefix check failed`, { status: 404 });
  }

  // 根据前缀找到对应的原始域名
  let target_host = null;
  
  // 解析 *-gh. 模式
  if (host_prefix && host_prefix.endsWith('-gh.')) {
    const prefix_part = host_prefix.slice(0, -4); // 移除 -gh.
    // 尝试找到对应的原始域名
    for (const original of Object.keys(domain_mappings)) {
      const normalized_original = original.trim().toLowerCase();
      if (normalized_original.replace(/\./g, '-') === prefix_part) {
        target_host = original;
        break;
      }
    }
  }

  if (!target_host) {
    // 再次检查 github.com 的情况，防止漏网
    if (host_prefix === 'gh.') {
        target_host = 'github.com';
    } else {
        return new Response(`Domain not configured for proxy. Host: ${effective_host}, Prefix: ${host_prefix}, Target lookup failed`, { status: 404 });
    }
  }

  // 直接使用正则表达式处理最常见的嵌套URL问题
  let pathname = url.pathname;
  
  // 修复特定的嵌套URL模式 - 直接移除嵌套URL部分
  // 匹配 /xxx/xxx/latest-commit/main/https%3A//gh.xxx.xxx/ 或 /xxx/xxx/tree-commit-info/main/https%3A//gh.xxx.xxx/
  pathname = pathname.replace(/(\/[^\/]+\/[^\/]+\/(?:latest-commit|tree-commit-info)\/[^\/]+)\/https%3A\/\/[^\/]+\/.*/, '$1');
  
  // 同样处理非编码版本
  pathname = pathname.replace(/(\/[^\/]+\/[^\/]+\/(?:latest-commit|tree-commit-info)\/[^\/]+)\/https:\/\/[^\/]+\/.*/, '$1');

  // 构建新的请求URL
  const new_url = new URL(url);
  new_url.host = target_host;
  new_url.pathname = pathname;
  new_url.protocol = 'https:';

  // 设置新的请求头
  const new_headers = new Headers(request.headers);
  new_headers.set('Host', target_host);
  new_headers.set('Referer', new_url.href);
  
  try {
    // 发起请求
    const response = await fetch(new_url.href, {
      method: request.method,
      headers: new_headers,
      body: request.method !== 'GET' ? request.body : undefined
    });

    // 克隆响应以便处理内容
    const response_clone = response.clone();
    
    // 设置新的响应头
    const new_response_headers = new Headers(response.headers);
    new_response_headers.set('access-control-allow-origin', '*');
    new_response_headers.set('access-control-allow-credentials', 'true');
    new_response_headers.set('cache-control', 'public, max-age=14400');
    new_response_headers.delete('content-security-policy');
    new_response_headers.delete('content-security-policy-report-only');
    new_response_headers.delete('clear-site-data');
    
    // 处理响应内容，替换域名引用，使用有效主机名来决定域名后缀
    const modified_body = await modifyResponse(response_clone, host_prefix, effective_host);

    return new Response(modified_body, {
      status: response.status,
      headers: new_response_headers
    });
  } catch (err) {
    return new Response(`Proxy Error: ${err.message}`, { status: 502 });
  }
}

// 获取当前主机名的前缀，用于匹配反向映射
function getProxyPrefix(host) {
  // 检查是否正好是 gh. 开头（对应 github.com）
  if (host.startsWith('gh.')) {
    return 'gh.';
  }

  // 检查 *-gh. 模式
  const ghMatch = host.match(/^([a-z0-9-]+-gh\.)/);
  if (ghMatch) {
    return ghMatch[1];
  }
  
  return null;
}

async function modifyResponse(response, host_prefix, effective_hostname) {
  // 只处理文本内容
  const content_type = response.headers.get('content-type') || '';
  if (!content_type.includes('text/') && !content_type.includes('application/json') && 
      !content_type.includes('application/javascript') && !content_type.includes('application/xml')) {
    return response.body;
  }

  let text = await response.text();
  
  // 使用有效主机名获取域名后缀部分（用于构建完整的代理域名）
  const domain_suffix = effective_hostname.substring(host_prefix.length);
  
  // 替换所有域名引用
  for (const [original_domain, _] of Object.entries(domain_mappings)) {
    const escaped_domain = original_domain.replace(/\./g, '\\.');
    
    // 强制把所有域名的前缀都改成 *-gh. 格式
    let current_prefix = original_domain.replace(/\./g, '-') + '-gh.';
    
    // 特殊处理 github.com
    if (original_domain === 'github.com') {
      current_prefix = 'gh.';
    }
    
    // 移除可能已经存在的重复后缀
    // 如果 domain_suffix 已经包含了 host_prefix 对应的部分，这会导致重复
    // 正确的逻辑是：domain_suffix 应该是去掉 host_prefix 后的部分，这在上面已经计算了
    // 但是，如果 host_prefix 提取有误，或者 effective_hostname 结构不符合预期，可能会出问题
    
    const full_proxy_domain = `${current_prefix}${domain_suffix}`;
    
    // 替换完整URLs
    text = text.replace(
      new RegExp(`https?://${escaped_domain}(?=/|"|'|\\s|$)`, 'g'),
      `https://${full_proxy_domain}`
    );
    
    // 替换协议相对URLs
    text = text.replace(
      new RegExp(`//${escaped_domain}(?=/|"|'|\\s|$)`, 'g'),
      `//${full_proxy_domain}`
    );
  }

  // 处理相对路径，使用有效主机名
  // 所有模式下都生效
  // 注意：这个替换可能会导致问题，因为它会匹配所有以 / 开头的路径
  // 许多 JS/CSS 引用可能是相对路径，但也可能是根路径
  // 如果这里强制替换为绝对路径，可能会导致 URL 拼接错误
  // 例如：如果原文本是 "/assets/foo.js"，它会被替换为 "https://github-githubassets-com-gh.xxx.com/assets/foo.js"
  // 如果原文本已经是 "https://github-githubassets-com-gh.xxx.com/assets/foo.js" (被上面的循环替换了)，这里不会再匹配（因为前面的 http... 不符合 (?<=["'])）
  // 但是，如果原文本是相对路径，如 "/assets/foo.js"，并且当前页面已经是代理页面
  // 浏览器会自动将其解析为当前域名下的路径，通常不需要我们手动替换
  // 手动替换反而可能导致像 `https://domain.com/assetshttps://domain.com/foo.js` 这种奇怪的 URL
  // 除非是为了处理某些特定的动态加载脚本，否则应该谨慎使用
  
  // 暂时注释掉这段代码，看看是否解决 "URL 拼接" 问题
  /*
  text = text.replace(
    /(?<=["'])\/(?!\/|[a-zA-Z]+:)/g,
    `https://${effective_hostname}/`
  );
  */

  return text;
}
