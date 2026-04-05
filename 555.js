/**
 * @name 四大音乐源合辑
 * @description QQ / 网易 / 酷狗 / 酷我 音乐搜索播放，基于 jbsou 和 vkeys 接口
 * @version 2.0.0
 * @author lx-music-source
 * @homepage https://github.com/lyswhut/lx-music-source
 */

/******/ (() => { // webpackBootstrap
/******/ 	"use strict";

// 获取 LX Music 环境变量
const { EVENT_NAMES, on, send, request, utils: lxUtils, version, currentScriptInfo } = globalThis.lx;

// 工具函数
const utils = {
  buffer: {
    from: lxUtils.buffer.from,
    bufToString: lxUtils.buffer.bufToString,
  },
  crypto: {
    md5: lxUtils.crypto.md5,
  },
};

// 请求头配置
const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36',
  'Accept': 'application/json, text/plain, */*',
  'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
  'Referer': 'https://y.qq.com/',
};

// API 地址
const QQ_SEARCH_API = 'https://api.vkeys.cn/v2/music/tencent/search/song';
const QQ_PLAY_API = 'https://api.vkeys.cn/v2/music/tencent/geturl';
const JIANBIN_API = 'https://www.jbsou.cn/';

// 源配置 - 必须正确导出
const sources = {
  qq: { name: 'QQ音乐', type: 'music', actions: ['musicUrl'], qualitys: ['128k'] },
  netease: { name: '网易云音乐', type: 'music', actions: ['musicUrl'], qualitys: ['128k'] },
  kugou: { name: '酷狗音乐', type: 'music', actions: ['musicUrl'], qualitys: ['128k'] },
  kuwo: { name: '酷我音乐', type: 'music', actions: ['musicUrl'], qualitys: ['128k'] },
};

// ========== 核心功能：获取播放URL ==========
async function getMusicUrl(source, musicInfo, quality) {
  return new Promise((resolve, reject) => {
    console.log(`获取音乐URL: ${source}`, musicInfo, quality);
    
    if (source === 'qq') {
      const apiUrl = `${QQ_PLAY_API}?mid=${encodeURIComponent(musicInfo.songmid)}&quality=9`;
      request(apiUrl, { headers: HEADERS }, (err, resp) => {
        if (err) {
          reject(new Error(`请求失败: ${err.message}`));
          return;
        }
        try {
          const data = typeof resp.body === 'string' ? JSON.parse(resp.body) : resp.body;
          if (data && data.code === 200 && data.data && data.data.url) {
            resolve(data.data.url);
          } else {
            reject(new Error('获取播放链接失败，可能为VIP歌曲'));
          }
        } catch (e) {
          reject(new Error(`解析失败: ${e.message}`));
        }
      });
    } 
    else if (source === 'netease' || source === 'kugou' || source === 'kuwo') {
      const playUrl = musicInfo.url || musicInfo.playUrl;
      if (playUrl && playUrl.startsWith('http')) {
        resolve(playUrl);
      } else {
        reject(new Error('获取播放链接失败'));
      }
    }
    else {
      reject(new Error(`不支持的音乐源: ${source}`));
    }
  });
}

// ========== 搜索功能 ==========
async function search(keyword, page, type) {
  return new Promise(async (resolve) => {
    const results = [];
    const sourcesToSearch = (type === 'all' || !type) ? ['qq', 'netease', 'kugou', 'kuwo'] : [type];
    
    for (const src of sourcesToSearch) {
      try {
        if (src === 'qq') {
          const qqResults = await searchQQ(keyword);
          results.push(...qqResults);
        } else if (src === 'netease' || src === 'kugou' || src === 'kuwo') {
          const jbResults = await searchJianbin(keyword, src);
          results.push(...jbResults);
        }
      } catch (err) {
        console.error(`搜索${src}失败:`, err);
      }
    }
    
    resolve({
      result: results,
      page: page || 1,
      pagecount: 1,
      total: results.length,
    });
  });
}

// QQ音乐搜索
async function searchQQ(keyword) {
  return new Promise((resolve) => {
    const url = `${QQ_SEARCH_API}?word=${encodeURIComponent(keyword)}`;
    request(url, { headers: HEADERS }, (err, resp) => {
      if (err) {
        resolve([]);
        return;
      }
      try {
        const data = typeof resp.body === 'string' ? JSON.parse(resp.body) : resp.body;
        if (!data || !Array.isArray(data.data)) {
          resolve([]);
          return;
        }
        const results = data.data.filter(item => item && item.mid).map(item => ({
          id: item.mid,
          name: item.song || item.name || '未知歌曲',
          artist: item.singer || item.artist || '未知歌手',
          album: item.album || '',
          pic: item.cover || item.pic || '',
          songmid: item.mid,
          strMediaMid: item.mid,
          source: 'qq',
        }));
        resolve(results);
      } catch (e) {
        resolve([]);
      }
    });
  });
}

// Jianbin源搜索（网易/酷狗/酷我）
async function searchJianbin(keyword, source) {
  return new Promise((resolve) => {
    let typeParam = '';
    if (source === 'netease') typeParam = 'netease';
    else if (source === 'kugou') typeParam = 'kugou';
    else typeParam = 'kuwo';
    
    const params = `input=${encodeURIComponent(keyword)}&filter=name&type=${typeParam}&page=1`;
    
    request(JIANBIN_API, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
        'User-Agent': HEADERS['User-Agent'],
        'Referer': 'https://www.jbsou.cn/',
      },
      body: params,
    }, (err, resp) => {
      if (err) {
        resolve([]);
        return;
      }
      try {
        const data = typeof resp.body === 'string' ? JSON.parse(resp.body) : resp.body;
        const list = Array.isArray(data.data) ? data.data : [];
        const results = list.filter(item => item && item.url).map(item => ({
          id: item.url,
          name: item.name || '未知歌曲',
          artist: item.artist || '未知歌手',
          album: item.album || '',
          pic: item.cover || '',
          url: item.url,
          playUrl: item.url,
          source: source,
        }));
        resolve(results);
      } catch (e) {
        resolve([]);
      }
    });
  });
}

// ========== 歌曲详情 ==========
async function detail(id) {
  return {
    song: [{
      id: id,
      name: id,
      artist: '',
      album: '',
      pic: '',
      source: '',
    }],
  };
}

// ========== 获取URL ==========
async function url(id, quality) {
  throw new Error('请通过搜索后直接播放');
}

// ========== 监听LX Music的请求 ==========
on(EVENT_NAMES.request, ({ source, action, info }) => {
  if (action === 'musicUrl') {
    return getMusicUrl(source, info.musicInfo, info.type).catch(err => {
      console.error(err.message);
      return Promise.reject(err);
    });
  }
  return Promise.reject(new Error(`不支持的操作: ${action}`));
});

// ========== 通知LX Music初始化完成 ==========
send(EVENT_NAMES.inited, {
  status: true,
  sources: sources,
});

/******/ })()
;
