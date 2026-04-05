// LX Music 自定义源：QQ / 网易 / 酷狗 / 酷我 四大音乐巨头
// 说明：本源码基于 coco-downloader 中的 QQ、Jianbin(网易/酷狗/酷我) provider 实现。
// 这里采用 LX Music 自定义源标准导出格式。

const HEADERS_QQ = {
  accept: '*/*',
  'accept-language': 'zh-CN,zh;q=0.9,en;q=0.8',
  origin: 'https://y.qq.com',
  referer: 'https://y.qq.com/',
  'sec-ch-ua': '"Google Chrome";v="143", "Chromium";v="143", "Not A(Brand";v="24"',
  'sec-ch-ua-mobile': '?0',
  'sec-ch-ua-platform': '"Windows"',
  'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36',
};

const HEADERS_JIANBIN = {
  accept: 'application/json, text/javascript, */*; q=0.01',
  'accept-encoding': 'gzip, deflate, br',
  'accept-language': 'zh-CN,zh;q=0.9,en;q=0.8',
  'content-type': 'application/x-www-form-urlencoded; charset=UTF-8',
  origin: 'https://www.jbsou.cn',
  referer: 'https://www.jbsou.cn/',
  'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36',
};

const QQ_SEARCH_URL = 'https://api.vkeys.cn/v2/music/tencent/search/song';
const QQ_PLAY_URL = 'https://api.vkeys.cn/v2/music/tencent/geturl';
const JIANBIN_BASE_URL = 'https://www.jbsou.cn/';

const PROVIDERS = {
  qq: { name: 'QQ', prefix: 'qq:' },
  netease: { name: '网易', prefix: 'netease:' },
  kugou: { name: '酷狗', prefix: 'kugou:' },
  kuwo: { name: '酷我', prefix: 'kuwo:' },
};

function encodeId(provider, idValue) {
  return `${provider}:${idValue}`;
}

function decodeId(rawId) {
  const matched = rawId.match(/^([a-z]+):(.+)$/);
  if (!matched) return null;
  return {
    provider: matched[1],
    id: matched[2],
  };
}

async function qqSearch(keyword) {
  const url = `${QQ_SEARCH_URL}?word=${encodeURIComponent(keyword)}`;
  const res = await fetch(url, { headers: HEADERS_QQ });
  const data = await res.json().catch(() => ({}));
  if (!data || !Array.isArray(data.data)) return [];

  return data.data
    .filter(item => item?.mid)
    .map(item => ({
      id: encodeId('qq', item.mid),
      name: item.song || item.name || '未知歌曲',
      artist: item.singer || item.artist || '未知歌手',
      album: item.album || '',
      pic: item.cover || item.pic || '',
      source: PROVIDERS.qq.name,
    }));
}

async function jianbinSearch(keyword, source) {
  const params = new URLSearchParams({
    input: keyword,
    filter: 'name',
    type: source,
    page: '1',
  });
  const res = await fetch(JIANBIN_BASE_URL, {
    method: 'POST',
    headers: HEADERS_JIANBIN,
    body: params.toString(),
  });
  const data = await res.json().catch(() => ({}));
  const list = Array.isArray(data.data) ? data.data : [];

  return list
    .filter(item => item?.url)
    .map(item => ({
      id: encodeId(source, encodeURIComponent(item.url)),
      name: item?.name || '未知歌曲',
      artist: item?.artist || '未知歌手',
      album: item?.album || '',
      pic: item?.cover || '',
      source: PROVIDERS[source].name,
    }));
}

async function resolveRedirect(url) {
  try {
    const res = await fetch(url, { method: 'HEAD', redirect: 'follow' });
    if (res.ok) {
      return res.url || url;
    }
  } catch (error) {
    console.warn('resolveRedirect error', error);
  }
  return url;
}

async function search(keyword, page = 1) {
  const [qqResults, neteaseResults, kugouResults, kuwoResults] = await Promise.all([
    qqSearch(keyword),
    jianbinSearch(keyword, 'netease'),
    jianbinSearch(keyword, 'kugou'),
    jianbinSearch(keyword, 'kuwo'),
  ]);

  return {
    result: [...qqResults, ...neteaseResults, ...kugouResults, ...kuwoResults],
    page,
    pagecount: 1,
    total: 0,
  };
}

async function detail(id) {
  const parsed = decodeId(id);
  const sourceName = parsed ? PROVIDERS[parsed.provider]?.name || '未知来源' : '未知来源';
  return {
    song: [
      {
        id,
        name: id,
        artist: sourceName,
        album: '',
        pic: '',
        source: sourceName,
      },
    ],
  };
}

async function url(id) {
  const parsed = decodeId(id);
  if (!parsed) {
    throw new Error('无效歌曲 id');
  }

  if (parsed.provider === 'qq') {
    const apiUrl = `${QQ_PLAY_URL}?mid=${encodeURIComponent(parsed.id)}&quality=9`;
    const res = await fetch(apiUrl, { headers: HEADERS_QQ });
    const data = await res.json().catch(() => ({}));
    if (!data || data.code !== 200 || !data.data || !data.data.url) {
      throw new Error('获取 QQ 播放链接失败');
    }
    return { url: data.data.url };
  }

  if (parsed.provider === 'netease' || parsed.provider === 'kugou' || parsed.provider === 'kuwo') {
    const decoded = decodeURIComponent(parsed.id);
    const finalUrl = await resolveRedirect(decoded);
    return { url: finalUrl };
  }

  throw new Error('不支持的音乐源');
}

export default {
  name: 'QQ/网易/酷狗/酷我 四大音乐源',
  author: 'coco-downloader 转换',
  version: '1.0.0',
  search,
  detail,
  url,
};
