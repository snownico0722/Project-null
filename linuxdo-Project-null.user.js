// ==UserScript==
// @name         Linux DO 溶解计划
// @namespace    https://linux.do/
// @version      0.8.0
// @homepageURL  https://greasyfork.org/zh-CN/scripts/587760-linux-do-%E6%BA%B6%E8%A7%A3%E8%AE%A1%E5%88%92
// @description  将指定用户的可见身份与装扮替换或清除，并提供帖子隐藏、仅针对溶解作者的标题清洗、主页跳转保护与 @ 假名的无感反向映射。
// @author       qiuqiu & ChatGPT
// @match        https://linux.do/*
// @match        https://www.linux.do/*
// @run-at       document-start
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_addValueChangeListener
// @grant        GM_registerMenuCommand
// @license      GPL-3.0-or-later
// @noframes
// ==/UserScript==

/*
 * Linux DO 溶解计划
 *
 * Discourse 用户识别、动态 DOM 扫描与 SPA 路由适配思路参考：
 * LinuxDo Sight shield 1.7.2，作者 Ooxygen7，MIT License。
 * https://greasyfork.org/scripts/584208-linuxdo-sight-shield
 */

(function () {
  'use strict';

  const SCRIPT_NAME = '溶解计划';
  const STORE_KEY = 'ldd_state_v1';
  const STYLE_ID = 'ldd-style';
  const UI_ID = 'ldd-ui';
  const HEADER_BUTTON_ID = 'ldd-header-button';
  const TOAST_ID = 'ldd-toast';
  const PROFILE_BLOCK_FLAG = 'ldd_blocked_profile_v1';
  const HOUR = 60 * 60 * 1000;
  const TIME_IDLE_LIMIT = 10 * HOUR;
  const TIME_MAX_LIMIT = 24 * HOUR;
  const MAX_SCOPE_ALIAS_CACHE = 128;

  const DEFAULT_CONFIG = Object.freeze({
    enabled: true,
    resetMode: 'time',
    replaceAvatars: true,
    hideIdentityDecorations: true,
    hideSignatures: true,
    mapAliasMentions: true,
    hideDissolvedTopics: true,
    cleanTopicTitles: true,
    pureMode: false
  });

  const ALIAS_WORDS = Object.freeze([
    'acorn', 'agate', 'alder', 'amber', 'amity', 'anchor', 'anise', 'apple',
    'apricot', 'arbor', 'arctic', 'arrow', 'aspen', 'atlas', 'autumn', 'azalea',
    'bamboo', 'banner', 'barley', 'basil', 'beacon', 'berry', 'birch', 'blossom',
    'bluebell', 'breeze', 'brook', 'buttercup', 'cactus', 'canary', 'canyon', 'caramel',
    'cedar', 'cherry', 'chestnut', 'cinder', 'circle', 'citrus', 'clover', 'cobalt',
    'comet', 'coral', 'cosmos', 'cotton', 'cricket', 'crystal', 'dahlia', 'daisy',
    'delta', 'dewdrop', 'drift', 'elmwood', 'ember', 'falcon', 'fennel', 'fernleaf',
    'finch', 'flannel', 'flora', 'forest', 'fossil', 'frost', 'garden', 'garnet',
    'ginkgo', 'glacier', 'glimmer', 'golden', 'granite', 'grove', 'harbor', 'hazel',
    'heather', 'heron', 'hickory', 'horizon', 'indigo', 'island', 'ivory', 'jasper',
    'juniper', 'lagoon', 'lantern', 'laurel', 'lavender', 'lemon', 'lilac', 'linden',
    'lotus', 'maple', 'marble', 'marigold', 'meadow', 'mercury', 'misty', 'moonlit',
    'mossy', 'nectar', 'olive', 'orchid', 'pebble', 'pepper', 'petal', 'pinecone',
    'plumage', 'pollen', 'prairie', 'quartz', 'raven', 'ripple', 'river', 'robin',
    'rosebud', 'rosemary', 'saffron', 'sagebrush', 'sandbar', 'scarlet', 'seabird', 'seashell',
    'shadow', 'shore', 'silver', 'skyline', 'spruce', 'starling', 'stone', 'sunbeam',
    'sunset', 'thistle', 'timber', 'tulip', 'valley', 'velvet', 'violet', 'willow',
    'winter', 'woodland', 'yarrow', 'zephyr', 'almond', 'anemone', 'biscuit', 'button',
    'candle', 'canvas', 'cello', 'chalk', 'cinnamon', 'copper', 'corduroy', 'crayon',
    'cushion', 'denim', 'doodle', 'feather', 'fiddle', 'folder', 'glassy', 'hammer',
    'honey', 'jacket', 'kettle', 'ladder', 'linen', 'magnet', 'mitten', 'mosaic',
    'needle', 'notebook', 'parcel', 'pencil', 'pillow', 'pocket', 'pottery', 'ribbon',
    'saddle', 'satchel', 'scissor', 'spindle', 'spoonful', 'sticker', 'thread', 'velcro',
    'wallet', 'whistle', 'window', 'woolen', 'basket', 'bottle', 'bucket', 'cabinet',
    'camera', 'coppery', 'curtain', 'drawer', 'fabric', 'frame', 'glass', 'hinge',
    'keypad', 'mirror', 'napkin', 'paper', 'platter', 'saucer', 'shelf', 'socket',
    'staple', 'tablet', 'teacup', 'thimble', 'ticket', 'utensil', 'vessel', 'applause',
    'balance', 'bounty', 'bright', 'calmness', 'chance', 'charm', 'cheer', 'clarity',
    'comfort', 'courage', 'curious', 'delight', 'dreamer', 'eager', 'fancy', 'freedom',
    'friendly', 'gentle', 'gladness', 'grace', 'harmony', 'honest', 'hopeful', 'kindly',
    'lively', 'mellow', 'merit', 'modest', 'nimble', 'patient', 'peaceful', 'playful',
    'pleasant', 'poise', 'proudly', 'quiet', 'radiant', 'ready', 'serene', 'simple',
    'sincere', 'steady', 'sunny', 'trusty', 'upbeat', 'vivid', 'wonder', 'worthy',
    'brisk', 'clever', 'crisp', 'dapper', 'fairly', 'fuzzy', 'glowing', 'jolly',
    'lucid', 'polite', 'rapid', 'silken', 'softly', 'sturdy', 'subtle', 'swift',
    'tender', 'tranquil', 'warmth', 'wisdom', 'active', 'adventure', 'artist', 'baker',
    'builder', 'captain', 'carpenter', 'coder', 'dancer', 'designer', 'driver', 'farmer',
    'gardener', 'maker', 'mentor', 'painter', 'pilot', 'reader', 'sailor', 'singer',
    'teacher', 'traveler', 'writer', 'artisan', 'keeper', 'player', 'ranger', 'scholar',
    'speaker', 'thinker', 'walker', 'weaver', 'archer', 'brewer', 'camper', 'climber',
    'diver', 'editor', 'explorer', 'fisher', 'grower', 'helper', 'learner', 'listener',
    'runner', 'seeker', 'skater', 'spinner', 'swimmer', 'wanderer', 'alphabet', 'arcade',
    'buttoned', 'castle', 'cipher', 'compass', 'dragonfly', 'echoes', 'festival', 'firefly',
    'gallery', 'guitar', 'harvest', 'jigsaw', 'journal', 'library', 'melody', 'museum',
    'novel', 'origami', 'puzzle', 'rhythm', 'sonnet', 'story', 'studio', 'theater',
    'violin', 'whimsy', 'balloon', 'carousel', 'confetti', 'parade', 'picnic', 'spectrum',
    'treasure', 'voyage', 'planet', 'saturn', 'meteor', 'nebula', 'orbit', 'rocket',
    'solar', 'stellar', 'cosmic', 'lunar', 'zenith', 'astral', 'cometary', 'galaxy',
    'pulsar', 'asteroid', 'meridian', 'northstar', 'signal', 'vector', 'matrix', 'pixel',
    'binary', 'circuit', 'kernel', 'lambda', 'module', 'packet', 'portal', 'prism',
    'quasar', 'render', 'script', 'server', 'syntax', 'tensor', 'token', 'vertex',
    'widget', 'browser', 'console', 'domain', 'memory', 'network', 'router', 'schema',
    'stream', 'switch', 'threaded', 'buffer', 'cache', 'cluster', 'codec', 'debug',
    'devices', 'digital', 'engine', 'gadget', 'logic', 'mobile', 'object', 'prompt',
    'sensor', 'system', 'utility', 'archive', 'bookmark', 'caption', 'chapter', 'column',
    'comment', 'dialog', 'header', 'index', 'layout', 'margin', 'outline', 'panel',
    'paragraph', 'profile', 'record', 'section', 'sidebar', 'topic',
    'afterglow', 'algorithm', 'alligator', 'animation', 'apartment', 'armadillo', 'artichoke', 'backboard', 'ballpoint', 'bandstand', 'beachball', 'beanstalk', 'blueberry', 'booklover', 'butterfly', 'cafeteria', 'carnation', 'celebrate', 'chamomile', 'clipboard', 'coastline', 'courtyard', 'crossroad', 'dandelion', 'dreamland', 'evergreen', 'farmhouse', 'feathered', 'fireplace', 'fireproof', 'flagstone', 'flowerpot', 'footprint', 'gentleman', 'goldfinch', 'grassland', 'harmonica', 'honeycomb', 'houseboat', 'jellybean', 'landscape', 'lightning', 'moonlight', 'moonstone', 'orchestra', 'paintwork', 'paperclip', 'pineapple', 'porcelain', 'raincloud', 'rainstorm', 'raspberry', 'riverbank', 'sailcloth', 'sandstone', 'seashells', 'snowflake', 'starboard', 'starlight', 'sunflower', 'telescope', 'turntable', 'turquoise', 'waterfall', 'waterline', 'wildberry', 'xylophone', 'yesterday',
  ]);

  const ALIAS_WORDS_BY_LENGTH = Object.freeze({
    5: Object.freeze(ALIAS_WORDS.filter(word => word.length === 5)),
    6: Object.freeze(ALIAS_WORDS.filter(word => word.length === 6)),
    7: Object.freeze(ALIAS_WORDS.filter(word => word.length === 7)),
    8: Object.freeze(ALIAS_WORDS.filter(word => word.length === 8)),
    9: Object.freeze(ALIAS_WORDS.filter(word => word.length === 9))
  });

  const runtime = {
    state: loadState(),
    dissolvedSet: new Set(),
    scanQueued: false,
    pendingRoots: new Set(),
    scanning: false,
    observer: null,
    routeHooked: false,
    routeTimer: null,
    activeTriggerNodes: new WeakSet(),
    aliasCache: new Map(),
    scopeAliasMaps: new Map(),
    composerMentionSnapshots: new WeakMap(),
    exposedAliases: new Map(),
    visibleRealUsernames: new Map(),
    visibleDisplayNames: new Map(),
    userCardContext: null,
    pageGeneration: 0,
    lastLocation: location.href,
    suppressMutations: 0,
    identityRevision: 0,
    visualObservers: new Map(),
    persistedStateSnapshot: ''
  };

  runtime.persistedStateSnapshot = JSON.stringify(runtime.state);
  rebuildSets();

  function defaultState() {
    const now = Date.now();
    return {
      version: 7,
      config: { ...DEFAULT_CONFIG },
      dissolvedUsers: [],
      secret: randomToken(24),
      topicSalt: randomToken(16),
      timeEpoch: {
        id: randomToken(16),
        startedAt: now,
        lastTriggeredAt: 0
      }
    };
  }

  function loadState() {
    try {
      const raw = GM_getValue(STORE_KEY, '');
      const parsed = typeof raw === 'string' ? JSON.parse(raw || '{}') : raw;
      return normalizeState(parsed);
    } catch (error) {
      console.warn('[DissolvePlan] 状态读取失败，已使用默认配置。', error);
      return defaultState();
    }
  }

  function normalizeState(value) {
    const base = defaultState();
    const state = value && typeof value === 'object' ? value : {};
    const config = state.config && typeof state.config === 'object' ? state.config : {};
    const resetMode = config.resetMode === 'topic' ? 'topic' : 'time';
    const timeEpoch = state.timeEpoch && typeof state.timeEpoch === 'object' ? state.timeEpoch : {};

    const cleanTopicTitles = typeof config.cleanTopicTitles === 'boolean'
      ? config.cleanTopicTitles
      : config.cleanTitleEmoji !== false || config.cleanTitleBracketPrefixes !== false;

    return {
      version: 7,
      config: {
        enabled: config.enabled !== false,
        resetMode,
        replaceAvatars: config.replaceAvatars !== false,
        hideIdentityDecorations: config.hideIdentityDecorations !== false,
        hideSignatures: config.hideSignatures !== false,
        mapAliasMentions: config.mapAliasMentions !== false,
        hideDissolvedTopics: typeof config.hideDissolvedTopics === 'boolean'
          ? config.hideDissolvedTopics
          : true,
        cleanTopicTitles,
        pureMode: config.pureMode === true || config.anonymousMode === true
      },
      dissolvedUsers: uniqueUsernames(state.dissolvedUsers),
      secret: typeof state.secret === 'string' && state.secret.length >= 12
        ? state.secret
        : base.secret,
      topicSalt: typeof state.topicSalt === 'string' && state.topicSalt
        ? state.topicSalt
        : base.topicSalt,
      timeEpoch: {
        id: typeof timeEpoch.id === 'string' && timeEpoch.id
          ? timeEpoch.id
          : base.timeEpoch.id,
        startedAt: finiteTimestamp(timeEpoch.startedAt, base.timeEpoch.startedAt),
        lastTriggeredAt: finiteTimestamp(timeEpoch.lastTriggeredAt, 0)
      }
    };
  }

  function finiteTimestamp(value, fallback) {
    const number = Number(value);
    return Number.isFinite(number) && number >= 0 ? number : fallback;
  }

  function uniqueUsernames(values) {
    if (!Array.isArray(values)) return [];
    const result = [];
    const seen = new Set();
    for (const value of values) {
      const normalized = normalizeUsername(value);
      if (!normalized || seen.has(normalized)) continue;
      seen.add(normalized);
      result.push(normalized);
    }
    return result;
  }

  function readPersistedState() {
    try {
      const raw = GM_getValue(STORE_KEY, '');
      if (raw === '' || raw === null || raw === undefined) return null;
      return normalizeState(typeof raw === 'string' ? JSON.parse(raw) : raw);
    } catch (error) {
      console.warn('[DissolvePlan] 合并最新状态失败，将保存当前标签页状态。', error);
      return null;
    }
  }

  function saveState(changedFields = []) {
    const changed = new Set(changedFields);
    const latest = readPersistedState();
    const latestSnapshot = latest ? JSON.stringify(latest) : '';
    const visualBeforeMerge = stateVisualFingerprint(runtime.state);

    if (
      latest
      && runtime.persistedStateSnapshot
      && latestSnapshot !== runtime.persistedStateSnapshot
    ) {
      for (const key of ['config', 'dissolvedUsers', 'secret', 'topicSalt', 'timeEpoch']) {
        if (!changed.has(key)) runtime.state[key] = latest[key];
      }
    }

    if (stateVisualFingerprint(runtime.state) !== visualBeforeMerge) rebuildSets();
    const serialized = JSON.stringify(runtime.state);
    GM_setValue(STORE_KEY, serialized);
    runtime.persistedStateSnapshot = serialized;
  }

  function rebuildSets() {
    runtime.dissolvedSet = new Set(runtime.state.dissolvedUsers.map(normalizeUsername));
    clearIdentityCaches();
  }

  function clearIdentityCaches() {
    runtime.aliasCache.clear();
    runtime.scopeAliasMaps.clear();
    runtime.exposedAliases.clear();
    runtime.visibleRealUsernames.clear();
    runtime.visibleDisplayNames.clear();
    runtime.composerMentionSnapshots = new WeakMap();
    runtime.identityRevision++;
  }

  function normalizeUsername(value) {
    return String(value || '')
      .trim()
      .replace(/^@+/, '')
      .toLowerCase();
  }

  function splitUsernames(value) {
    return uniqueUsernames(String(value || '').split(/[\s,，;；]+/));
  }

  function randomToken(length) {
    const alphabet = 'abcdefghijklmnopqrstuvwxyz0123456789';
    let output = '';
    if (globalThis.crypto?.getRandomValues) {
      const bytes = new Uint8Array(length);
      globalThis.crypto.getRandomValues(bytes);
      for (const byte of bytes) output += alphabet[byte % alphabet.length];
      return output;
    }
    while (output.length < length) {
      output += Math.random().toString(36).slice(2);
    }
    return output.slice(0, length);
  }

  function fnv1a(value) {
    let hash = 0x811c9dc5;
    for (let index = 0; index < value.length; index++) {
      hash ^= value.charCodeAt(index);
      hash = Math.imul(hash, 0x01000193);
    }
    return hash >>> 0;
  }

  function hashPair(value) {
    const first = fnv1a(value);
    const second = fnv1a(value.split('').reverse().join('') + '|reverse');
    return [first, second];
  }

  function usernameFromHref(href) {
    if (href === null || href === undefined || href === '') return '';
    try {
      const url = new URL(String(href), location.href);
      const targetHost = url.hostname.replace(/^www\./i, '').toLowerCase();
      const currentHost = location.hostname.replace(/^www\./i, '').toLowerCase();
      if (targetHost !== currentHost) return '';
      const match = url.pathname.match(/^\/u\/([^/?#]+)(?:\/|$)/i);
      if (!match) return '';
      try {
        return decodeURIComponent(match[1]);
      } catch (_) {
        return match[1];
      }
    } catch (_) {
      return '';
    }
  }

  function usernameFromAvatarSrc(src) {
    if (src === null || src === undefined || src === '') return '';
    try {
      const url = new URL(String(src), location.href);
      const match = url.pathname.match(/\/user_avatar\/[^/]+\/([^/?#]+)(?:\/|$)/i);
      if (!match) return '';
      try {
        return decodeURIComponent(match[1]);
      } catch (_) {
        return match[1];
      }
    } catch (_) {
      return '';
    }
  }

  function profileUsernameFromDestination(destination) {
    if (destination === null || destination === undefined || destination === '') return '';
    try {
      const url = new URL(String(destination), location.href);
      const targetHost = url.hostname.replace(/^www\./i, '').toLowerCase();
      const currentHost = location.hostname.replace(/^www\./i, '').toLowerCase();
      if (targetHost !== currentHost) return '';
      const match = url.pathname.match(/^\/u\/([^/?#]+)(?:\/|$)/i);
      if (!match) return '';
      try {
        return normalizeUsername(decodeURIComponent(match[1]));
      } catch (_) {
        return normalizeUsername(match[1]);
      }
    } catch (_) {
      return '';
    }
  }

  function isDissolvedProfileDestination(destination) {
    const username = profileUsernameFromDestination(destination);
    return Boolean(username && runtime.dissolvedSet.has(username));
  }

  function shouldAnonymizeUsername(username) {
    return Boolean(
      username
      && (runtime.state.config.pureMode || runtime.dissolvedSet.has(username))
    );
  }

  function anonymizedUsernames() {
    if (!runtime.state.config.pureMode) return runtime.dissolvedSet;
    const usernames = new Set(runtime.dissolvedSet);
    for (const names of runtime.visibleRealUsernames.values()) {
      names.forEach(username => usernames.add(username));
    }
    return usernames;
  }

  function usernameOf(element) {
    if (!element || element.nodeType !== Node.ELEMENT_NODE) return '';
    const nestedAvatar = element.querySelector?.(
      'img.avatar, img.user-image, img[data-avatar-template]'
    );
    return normalizeUsername(
      element.getAttribute('data-user-card')
      || element.getAttribute('data-username')
      || usernameFromHref(element.getAttribute('href'))
      || usernameFromAvatarSrc(element.getAttribute('src'))
      || usernameFromAvatarSrc(nestedAvatar?.getAttribute('src'))
      || element.__lddReplyUsername
    );
  }

  function topicIdFromHref(href) {
    const match = String(href || '').match(/\/t\/(?:[^/?#]+\/)?(\d+)(?:\/\d+)?(?:[/?#]|$)/i);
    return match ? match[1] : '';
  }

  function currentTopicId() {
    const pathMatch = location.pathname.match(/\/t\/(?:[^/?#]+\/)?(\d+)(?:\/\d+)?(?:\/|$)/i);
    return pathMatch ? pathMatch[1] : '';
  }

  function nearestTopicId(element) {
    if (!element || element.nodeType !== Node.ELEMENT_NODE) return currentTopicId();
    const direct = element.closest('[data-topic-id]')?.getAttribute('data-topic-id');
    if (direct) return String(direct);
    const row = element.closest('.topic-list-item, .latest-topic-list-item, .fps-result, .search-result');
    const link = row?.querySelector('a[href*="/t/"]');
    return topicIdFromHref(link?.getAttribute('href')) || currentTopicId();
  }

  function scopeFor(element) {
    if (runtime.state.config.resetMode === 'time') {
      return 'time:' + runtime.state.timeEpoch.id;
    }

    const card = element?.closest?.('.user-card, #user-card');
    if (card) {
      const assignedScope = String(card.getAttribute('data-ldd-scope') || '').trim();
      if (assignedScope) return assignedScope;
      const profile = card.querySelector('a[data-user-card], a[href^="/u/"], [data-username]');
      const username = usernameOf(profile);
      const context = runtime.userCardContext;
      if (context && context.username === username && Date.now() - context.at < 10000) {
        return context.scope;
      }
    }

    const topicId = nearestTopicId(element);
    if (topicId) return 'topic:' + topicId;
    return 'page:' + location.pathname;
  }

  function resetTimeEpoch(reason, shouldRescan) {
    const now = Date.now();
    runtime.state.timeEpoch = {
      id: randomToken(16),
      startedAt: now,
      lastTriggeredAt: 0
    };
    runtime.activeTriggerNodes = new WeakSet();
    clearIdentityCaches();
    saveState(['timeEpoch']);
    if (shouldRescan) {
      restoreAll();
      queueScan(document);
    }
    if (reason) console.info('[DissolvePlan] 随机身份周期已重置：' + reason);
  }

  function resetCurrentIdentities(reason) {
    if (runtime.state.config.resetMode === 'topic') {
      runtime.state.topicSalt = randomToken(16);
      clearIdentityCaches();
      saveState(['topicSalt']);
      restoreAll();
      queueScan(document);
      if (reason) console.info('[DissolvePlan] 帖子模式身份盐已重置：' + reason);
      return;
    }
    resetTimeEpoch(reason || '用户手动重置', true);
  }

  function ensureTimeEpoch() {
    if (runtime.state.config.resetMode !== 'time') return false;
    const now = Date.now();
    const epoch = runtime.state.timeEpoch;
    const idleExpired = epoch.lastTriggeredAt > 0 && now - epoch.lastTriggeredAt >= TIME_IDLE_LIMIT;
    const maximumExpired = now - epoch.startedAt >= TIME_MAX_LIMIT;
    if (!idleExpired && !maximumExpired) return false;
    resetTimeEpoch(idleExpired ? '距离上次触发已超过 10 小时' : '本轮身份已持续 24 小时', false);
    return true;
  }

  function markTriggered(node) {
    if (runtime.state.config.resetMode !== 'time') return;
    if (node && runtime.activeTriggerNodes.has(node)) return;
    if (node) runtime.activeTriggerNodes.add(node);
    const now = Date.now();
    // 避免同一批 DOM 节点造成连续写入；五分钟内只持久化一次活跃时间。
    if (now - runtime.state.timeEpoch.lastTriggeredAt >= 5 * 60 * 1000) {
      runtime.state.timeEpoch.lastTriggeredAt = now;
      saveState(['timeEpoch']);
    }
  }

  function identityFor(username, element) {
    const normalized = normalizeUsername(username);
    const scope = scopeFor(element);
    const cacheKey = scope + '|' + normalized;
    const cached = runtime.aliasCache.get(cacheKey);
    if (cached) return cached;

    const modeSalt = runtime.state.config.resetMode === 'topic' ? runtime.state.topicSalt : '';
    const [a, b] = hashPair(runtime.state.secret + '|' + modeSalt + '|' + scope + '|' + normalized);
    const alias = aliasForScope(scope, normalized);
    const identity = {
      alias,
      avatar: avatarDataUri(alias, a, b),
      scope
    };
    runtime.aliasCache.set(cacheKey, identity);
    return identity;
  }

  function greatestCommonDivisor(a, b) {
    let left = Math.abs(a);
    let right = Math.abs(b);
    while (right) {
      const remainder = left % right;
      left = right;
      right = remainder;
    }
    return left || 1;
  }

  function aliasForScope(scope, username) {
    let aliases = runtime.scopeAliasMaps.get(scope);
    if (!aliases) {
      aliases = buildScopeAliasMap(scope);
      runtime.scopeAliasMaps.set(scope, aliases);
    } else {
      // Map 的插入顺序作为轻量 LRU：访问后移到末尾。
      runtime.scopeAliasMaps.delete(scope);
      runtime.scopeAliasMaps.set(scope, aliases);
    }
    if (!aliases.has(username)) assignScopeAlias(aliases, scope, username);
    pruneScopeAliasCache();
    return aliases.get(username);
  }

  function pruneScopeAliasCache() {
    while (runtime.scopeAliasMaps.size > MAX_SCOPE_ALIAS_CACHE) {
      const oldestScope = runtime.scopeAliasMaps.keys().next().value;
      runtime.scopeAliasMaps.delete(oldestScope);
      runtime.exposedAliases.delete(oldestScope);
      runtime.visibleRealUsernames.delete(oldestScope);
      const prefix = oldestScope + '|';
      for (const key of Array.from(runtime.aliasCache.keys())) {
        if (key.startsWith(prefix)) runtime.aliasCache.delete(key);
      }
    }
  }

  function buildScopeAliasMap(scope) {
    const aliases = new Map();
    for (const username of Array.from(runtime.dissolvedSet).sort()) {
      assignScopeAlias(aliases, scope, username);
    }
    return aliases;
  }

  function assignScopeAlias(aliases, scope, username) {
    if (aliases.has(username)) return aliases.get(username);
    const usedWords = new Set(aliases.values());
    const modeSalt = runtime.state.config.resetMode === 'topic' ? runtime.state.topicSalt : '';
    const reservedUsernames = new Set(runtime.dissolvedSet);
    const visibleNames = runtime.visibleRealUsernames.get(scope);
    visibleNames?.forEach(value => reservedUsernames.add(value));
    const [first, second] = hashPair(runtime.state.secret + '|' + modeSalt + '|' + scope + '|' + username + '|word');
    const preferredLength = 5 + (first % 5);
    const lengthOrder = Array.from({ length: 5 }, (_, offset) => 5 + ((preferredLength - 5 + offset) % 5));
    let selected = '';

    for (const length of lengthOrder) {
      const bucket = ALIAS_WORDS_BY_LENGTH[length];
      if (!bucket.length) continue;
      const bucketSeed = fnv1a(second + '|' + first + '|' + length + '|' + username);
      let step = 1 + (bucketSeed % Math.max(1, bucket.length - 1));
      while (bucket.length > 1 && greatestCommonDivisor(step, bucket.length) !== 1) {
        step = (step % (bucket.length - 1)) + 1;
      }
      const startIndex = (first ^ bucketSeed) % bucket.length;

      for (let attempt = 0; attempt < bucket.length; attempt++) {
        const candidate = bucket[(startIndex + attempt * step) % bucket.length];
        if (usedWords.has(candidate) || reservedUsernames.has(candidate)) continue;
        selected = candidate;
        break;
      }
      if (selected) break;
    }

    if (!selected) selected = fallbackWordAlias(scope, username);
    aliases.set(username, selected);
    return selected;
  }

  function fallbackWordAlias(scope, username) {
    const modeSalt = runtime.state.config.resetMode === 'topic' ? runtime.state.topicSalt : '';
    const [first, second] = hashPair(runtime.state.secret + '|' + modeSalt + '|' + scope + '|' + username + '|fallback-word');
    const length = 5 + (first % 5);
    const bucket = ALIAS_WORDS_BY_LENGTH[length];
    return bucket[second % bucket.length];
  }

  function isActuallyExposed(element) {
    if (!element?.isConnected || element.closest('[hidden], [data-ldd-hidden-kind], [aria-hidden="true"]')) return false;
    let node = element;
    let depth = 0;
    while (node && node !== document.body && depth < 6) {
      const style = getComputedStyle(node);
      if (style.display === 'none' || style.visibility === 'hidden' || style.visibility === 'collapse') return false;
      node = node.parentElement;
      depth++;
    }
    return true;
  }

  function recordExposedIdentity(username, identity, element) {
    if (!username || !identity?.alias || !identity?.scope || !isActuallyExposed(element)) return;
    let reverse = runtime.exposedAliases.get(identity.scope);
    if (!reverse) {
      reverse = new Map();
      runtime.exposedAliases.set(identity.scope, reverse);
    }
    const alias = identity.alias.toLowerCase();
    if (reverse.has(alias) && reverse.get(alias) !== username) reverse.set(alias, '');
    else if (!reverse.has(alias)) reverse.set(alias, username);
  }

  function recordVisibleRealUsername(username, element) {
    if (!username || !isActuallyExposed(element)) return;
    const scope = scopeFor(element);
    let names = runtime.visibleRealUsernames.get(scope);
    if (!names) {
      names = new Set();
      runtime.visibleRealUsernames.set(scope, names);
    }
    names.add(username);
  }

  function normalizeDisplayName(value) {
    return String(value || '').replace(/\s+/g, ' ').trim().toLocaleLowerCase();
  }

  function recordVisibleDisplayName(username, value, element) {
    if (!username || !value || !isActuallyExposed(element)) return;
    const displayName = normalizeDisplayName(value);
    if (!displayName || displayName.length > 80) return;
    const scope = scopeFor(element);
    let names = runtime.visibleDisplayNames.get(scope);
    if (!names) {
      names = new Map();
      runtime.visibleDisplayNames.set(scope, names);
    }
    const existing = names.get(displayName);
    if (!existing || existing === username) names.set(displayName, username);
    else names.set(displayName, '');
  }

  function recordIdentityDisplayNames(username, element) {
    if (!username || !element) return;
    const values = [
      element.getAttribute?.('data-display-name'),
      element.getAttribute?.('title'),
      element.getAttribute?.('aria-label')
    ];
    const text = String(element.textContent || '').replace(/\s+/g, ' ').trim();
    if (text && text.length <= 80) values.push(text);
    values.filter(Boolean).forEach(value => recordVisibleDisplayName(username, value, element));
  }

  function displayNameUsername(label) {
    const scope = scopeFor(label);
    const names = runtime.visibleDisplayNames.get(scope);
    return names?.get(normalizeDisplayName(label.textContent)) || '';
  }

  function visibleRealUsernameSet(scope) {
    return new Set(runtime.visibleRealUsernames.get(scope) || []);
  }

  function exposedAliasReverseMap(scope) {
    const source = runtime.exposedAliases.get(scope);
    const reverse = new Map();
    if (!source) return reverse;
    for (const [alias, username] of source) {
      if (username) reverse.set(alias, username);
    }
    return reverse;
  }

  function mapAliasMentionsInSegment(segment, reverseMap, mappings) {
    const boundary = '[\\s([（【{<"\'“‘,，。:：;；!?！？]';
    const bypassPattern = new RegExp('(^|' + boundary + ')@@([A-Za-z0-9_.-]{1,40})(?![A-Za-z0-9_.-])', 'g');
    const mentionPattern = new RegExp('(^|' + boundary + ')@([A-Za-z]{5,9})(?![A-Za-z0-9_])', 'g');
    const bypassMarker = '\uE000ldd-at\uE001';
    const bypassed = String(segment || '').replace(bypassPattern, (whole, prefix, username) => {
      return prefix + bypassMarker + username;
    });
    const mapped = bypassed.replace(mentionPattern, (whole, prefix, alias) => {
      const normalizedAlias = alias.toLowerCase();
      const username = reverseMap.get(normalizedAlias);
      if (!username) return whole;
      mappings.set(normalizedAlias, username);
      return prefix + '@' + username;
    });
    return mapped.split(bypassMarker).join('@');
  }

  function mapAliasMentionsOutsideInlineCode(line, reverseMap, mappings) {
    let output = '';
    let index = 0;
    let inCode = false;
    let delimiterLength = 0;
    while (index < line.length) {
      if (line[index] === '`') {
        let end = index + 1;
        while (end < line.length && line[end] === '`') end++;
        const runLength = end - index;
        if (!inCode) {
          inCode = true;
          delimiterLength = runLength;
        } else if (runLength === delimiterLength) {
          inCode = false;
          delimiterLength = 0;
        }
        output += line.slice(index, end);
        index = end;
        continue;
      }
      let end = line.indexOf('`', index);
      if (end < 0) end = line.length;
      const segment = line.slice(index, end);
      output += inCode ? segment : mapAliasMentionsInSegment(segment, reverseMap, mappings);
      index = end;
    }
    return output;
  }

  function mapAliasMentionsInMarkdown(value, reverseMap) {
    const original = String(value || '');
    if (!reverseMap?.size || !original.includes('@')) {
      return { text: original, mappings: [] };
    }

    const parts = original.split(/(\r?\n)/);
    const mappings = new Map();
    let fence = '';
    for (let index = 0; index < parts.length; index += 2) {
      const line = parts[index];
      const fenceMatch = line.match(/^\s*(`{3,}|~{3,})/);
      if (fenceMatch) {
        const marker = fenceMatch[1][0];
        if (!fence) fence = marker;
        else if (marker === fence) fence = '';
        continue;
      }
      if (fence) continue;
      if (/^(?: {4}|\t)/.test(line)) continue;
      parts[index] = mapAliasMentionsOutsideInlineCode(line, reverseMap, mappings);
    }
    return {
      text: parts.join(''),
      mappings: Array.from(mappings, ([alias, username]) => ({ alias, username }))
    };
  }

  function composerEditorFrom(target) {
    const root = target?.closest?.('#reply-control, .composer, .composer-container')
      || document.querySelector('#reply-control');
    if (!root) return null;
    return root.querySelector(
      'textarea.d-editor-input, textarea.composer-editor, .d-editor-textarea-wrapper textarea, textarea[data-composer-input]'
    );
  }

  function composerAliasSnapshot(editor) {
    if (!editor) return null;
    const currentScope = scopeFor(editor);
    const existing = runtime.composerMentionSnapshots.get(editor);
    const hasDraft = Boolean(String(editor.value || '').trim());
    if (
      existing
      && existing.revision === runtime.identityRevision
      && (existing.scope === currentScope || hasDraft)
    ) return existing;
    const snapshot = {
      scope: currentScope,
      revision: runtime.identityRevision,
      reverseMap: exposedAliasReverseMap(currentScope),
      realUsernames: visibleRealUsernameSet(currentScope)
    };
    runtime.composerMentionSnapshots.set(editor, snapshot);
    return snapshot;
  }

  function mergedComposerAliasMap(editor) {
    const snapshot = composerAliasSnapshot(editor);
    const currentScope = scopeFor(editor);
    const currentMap = exposedAliasReverseMap(currentScope);
    const merged = new Map(snapshot?.reverseMap || []);
    const ambiguous = new Set();
    for (const [alias, username] of currentMap) {
      if (merged.has(alias) && merged.get(alias) !== username) {
        ambiguous.add(alias);
        continue;
      }
      merged.set(alias, username);
    }
    for (const alias of ambiguous) merged.delete(alias);
    return merged;
  }

  function mergedComposerRealUsernames(editor) {
    const snapshot = composerAliasSnapshot(editor);
    const currentScope = scopeFor(editor);
    const merged = new Set(snapshot?.realUsernames || []);
    visibleRealUsernameSet(currentScope).forEach(username => merged.add(username));
    return merged;
  }

  function setComposerText(editor, value) {
    const descriptor = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value');
    if (descriptor?.set) descriptor.set.call(editor, value);
    else editor.value = value;
    try {
      editor.dispatchEvent(new InputEvent('input', {
        bubbles: true,
        inputType: 'insertReplacementText',
        data: null
      }));
    } catch (_) {
      editor.dispatchEvent(new Event('input', { bubbles: true }));
    }
    editor.dispatchEvent(new Event('change', { bubbles: true }));
  }

  function mapComposerAliasMentions(target) {
    if (!runtime.state.config.enabled || !runtime.state.config.mapAliasMentions) return 0;
    const editor = composerEditorFrom(target);
    if (!editor || editor.closest('#' + UI_ID)) return 0;
    const originalText = editor.value;
    const reverseMap = mergedComposerAliasMap(editor);
    let result = mapAliasMentionsInMarkdown(originalText, reverseMap);
    if (!result.mappings.length || result.text === originalText) return 0;

    const realUsernames = mergedComposerRealUsernames(editor);
    const keepRealUsernames = new Set();
    for (const mapping of result.mappings) {
      if (!realUsernames.has(mapping.alias) || mapping.alias === mapping.username) continue;
      const chooseDissolved = globalThis.confirm(
        '检测到 @' + mapping.alias + ' 同时对应两个用户：\n\n'
        + '溶解身份：@' + mapping.username + '\n'
        + '真实同名用户：@' + mapping.alias + '\n\n'
        + '点击“确定”选择溶解身份；点击“取消”保留真实同名用户。'
      );
      if (!chooseDissolved) keepRealUsernames.add(mapping.alias);
    }

    if (keepRealUsernames.size) {
      const selectedMap = new Map(reverseMap);
      keepRealUsernames.forEach(alias => selectedMap.delete(alias));
      result = mapAliasMentionsInMarkdown(originalText, selectedMap);
    }
    if (result.text === originalText) return 0;
    setComposerText(editor, result.text);
    return result.mappings.length;
  }

  function interceptComposerAliasMentions() {
    document.addEventListener('focusin', event => {
      const editor = composerEditorFrom(event.target);
      if (editor && event.target === editor) composerAliasSnapshot(editor);
    }, true);

    document.addEventListener('click', event => {
      const submit = event.target?.closest?.(
        '#reply-control button.create, #reply-control .create, #reply-control button[type="submit"], .composer button.create'
      );
      if (submit) mapComposerAliasMentions(submit);
    }, true);

    document.addEventListener('keydown', event => {
      if (event.key !== 'Enter' || !(event.ctrlKey || event.metaKey)) return;
      const editor = composerEditorFrom(event.target);
      if (editor) mapComposerAliasMentions(editor);
    }, true);

    document.addEventListener('submit', event => {
      const editor = composerEditorFrom(event.target);
      if (editor) mapComposerAliasMentions(editor);
    }, true);
  }

  function avatarDataUri(alias, first, second) {
    const hue = first % 360;
    const saturation = 27 + (second % 9);
    const lightness = 62 + ((first ^ second) % 9);
    const initial = escapeXml(alias.slice(0, 1).toUpperCase());
    const svg = [
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96">',
      '<rect width="96" height="96" rx="48" fill="hsl(' + hue + ' ' + saturation + '% ' + lightness + '%)"/>',
      '<text x="48" y="64" text-anchor="middle" font-size="51" font-weight="600" font-family="Arial,Helvetica,sans-serif" fill="white" opacity=".96">',
      initial,
      '</text></svg>'
    ].join('');
    return 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(svg);
  }

  function escapeXml(value) {
    return String(value).replace(/[&<>"']/g, character => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;'
    })[character]);
  }

  function collect(root, selector) {
    if (!root) return [];
    const validRoot = root.nodeType === Node.ELEMENT_NODE || root.nodeType === Node.DOCUMENT_NODE;
    if (!validRoot) return [];
    const result = [];
    if (root.nodeType === Node.ELEMENT_NODE && root.matches(selector)) result.push(root);
    result.push(...root.querySelectorAll(selector));
    return result;
  }

  function withMutationSuppressed(callback) {
    runtime.suppressMutations++;
    try {
      return callback();
    } finally {
      runtime.suppressMutations--;
    }
  }

  function ensureOriginalState(element) {
    if (!element.__lddOriginal) element.__lddOriginal = Object.create(null);
    if (!element.__lddApplied) element.__lddApplied = Object.create(null);
    element.setAttribute('data-ldd-mutated', '1');
    return element.__lddOriginal;
  }

  function rememberProperty(element, key, value) {
    const original = ensureOriginalState(element);
    if (!(key in original)) original[key] = value;
  }

  function setPatchedAttribute(element, key, name, value) {
    const original = ensureOriginalState(element);
    const applied = element.__lddApplied;
    const current = element.getAttribute(name);
    if (!(key in original)) original[key] = current;
    else if (key in applied && current !== applied[key]) original[key] = current;
    applied[key] = value;
    if (value === null || value === undefined) {
      if (element.hasAttribute(name)) element.removeAttribute(name);
    } else if (current !== value) {
      element.setAttribute(name, value);
    }
  }

  function setPatchedStyle(element, key, property, value, priority = '') {
    const original = ensureOriginalState(element);
    const applied = element.__lddApplied;
    const current = element.style.getPropertyValue(property);
    const currentPriority = element.style.getPropertyPriority(property);
    if (!(key in original)) original[key] = { value: current, priority: currentPriority };
    else if (key in applied && (current !== applied[key].value || currentPriority !== applied[key].priority)) {
      original[key] = { value: current, priority: currentPriority };
    }
    applied[key] = { value, priority };
    if (current !== value || currentPriority !== priority) element.style.setProperty(property, value, priority);
  }

  function addPatchedClass(element, ...classNames) {
    if (!element || !classNames.length) return;
    ensureOriginalState(element);
    element.classList.add(...classNames);
    element.__lddApplied.className = element.getAttribute('class') || '';
  }

  function textPatchRecords(owner) {
    const original = ensureOriginalState(owner);
    if (!Array.isArray(original.textPatches)) original.textPatches = [];
    return original.textPatches;
  }

  function findTextPatch(owner, key, node) {
    return owner?.__lddOriginal?.textPatches?.find(record => record.key === key && record.node === node) || null;
  }

  function sourceTextForPatch(owner, key, node) {
    const record = findTextPatch(owner, key, node);
    if (!record) return String(node.nodeValue || '');
    return node.nodeValue === record.applied ? record.original : String(node.nodeValue || '');
  }

  function patchTextNode(owner, key, node, value) {
    if (!owner || !node || node.nodeType !== Node.TEXT_NODE) return;
    const records = textPatchRecords(owner);
    let record = records.find(item => item.key === key && item.node === node);
    const current = String(node.nodeValue || '');
    if (!record) {
      record = { key, node, original: current, applied: current };
      records.push(record);
    } else if (current !== record.applied) {
      record.original = current;
    }
    record.applied = String(value);
    if (current !== record.applied) node.nodeValue = record.applied;
  }

  function pruneTextPatchKey(owner, key, retainedNodes) {
    const records = owner?.__lddOriginal?.textPatches;
    if (!Array.isArray(records)) return;
    const retained = new Set(retainedNodes || []);
    owner.__lddOriginal.textPatches = records.filter(record => {
      if (record.key !== key || retained.has(record.node)) return true;
      if (record.node.isConnected && record.node.nodeValue === record.applied) {
        record.node.nodeValue = record.original;
      }
      return false;
    });
  }

  function restoreTextPatchKey(owner, key) {
    const records = owner?.__lddOriginal?.textPatches;
    if (!Array.isArray(records)) return;
    owner.__lddOriginal.textPatches = records.filter(record => {
      if (record.key !== key) return true;
      if (record.node.isConnected && record.node.nodeValue === record.applied) {
        record.node.nodeValue = record.original;
      }
      return false;
    });
  }

  function visibleTextNodes(element) {
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        const parent = node.parentElement;
        if (!parent || parent.closest('svg, script, style, code, pre')) return NodeFilter.FILTER_REJECT;
        return String(node.nodeValue || '').trim() ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
      }
    });
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    return nodes;
  }

  function replaceTextElement(element, identity, username) {
    if (!element || element.nodeType !== Node.ELEMENT_NODE) return;
    if (element.closest('#' + UI_ID + ', #' + TOAST_ID)) return;
    if (element.matches('script, style, textarea, input, code, pre')) return;
    if (element.querySelector('article, .cooked, aside.quote, .topic-list-item, .search-result')) return;

    const textNodes = visibleTextNodes(element);
    if (!textNodes.length) return;
    const sourceText = textNodes.map(node => sourceTextForPatch(element, 'identity', node)).join('').trim();
    if (!sourceText || sourceText.length > 80) return;
    const hasNestedIdentity = Array.from(element.children).some(child =>
      child.matches?.('[data-user-card], [data-username], a[href*="/u/"]')
      && String(child.textContent || '').trim()
    );
    if (hasNestedIdentity) return;

    pruneTextPatchKey(element, 'identity', textNodes);
    const mentionLike = element.matches('.mention, [class*="mention"]') || sourceText.startsWith('@');
    patchTextNode(element, 'identity', textNodes[0], (mentionLike ? '@' : '') + identity.alias);
    for (let index = 1; index < textNodes.length; index++) patchTextNode(element, 'identity', textNodes[index], '');
    element.setAttribute('data-ldd-alias', identity.alias);
    addPatchedClass(element, 'ldd-dissolved-name');
    recordExposedIdentity(username, identity, element);
  }

  const AVATAR_DECORATION_SELECTORS = [
    '.avatar-flair',
    '[class*="avatar-flair"]',
    '.avatar-frame',
    '[class*="avatar-frame"]',
    '.avatar-border',
    '[class*="avatar-border"]',
    '.avatar-decoration',
    '[class*="avatar-decoration"]',
    '.avatar-decor',
    '[class*="avatar-decor"]'
  ];
  const AVATAR_DECORATION_SELECTOR = AVATAR_DECORATION_SELECTORS.join(',');
  const DIRECT_AVATAR_DECORATION_SELECTOR = AVATAR_DECORATION_SELECTORS
    .map(selector => ':scope > ' + selector)
    .join(',');

  function markNeutralAvatarElement(element, host, clearBackground) {
    if (!element || element.nodeType !== Node.ELEMENT_NODE) return;
    rememberProperty(element, host ? 'neutralAvatarHost' : 'neutralAvatar', true);
    addPatchedClass(element, host ? 'ldd-neutral-avatar-host' : 'ldd-neutral-avatar');
    if (clearBackground) addPatchedClass(element, 'ldd-clear-avatar-frame');
  }

  function hideDirectAvatarDecorations(container) {
    if (!container || container.nodeType !== Node.ELEMENT_NODE) return;
    for (const decoration of container.querySelectorAll(DIRECT_AVATAR_DECORATION_SELECTOR)) {
      // 某些第三方头像框把头像本身包在带 frame/decor 类名的容器里；
      // 这种节点不能整块隐藏，只清掉外层视觉样式。
      if (decoration.querySelector('img.avatar, img.user-image, img[data-avatar-template], .avatar img')) {
        markNeutralAvatarElement(decoration, true, true);
      } else {
        hideElement(decoration, 'avatar-decoration');
      }
    }
  }

  function neutralizeAvatarAppearance(avatar) {
    if (!runtime.state.config.hideIdentityDecorations || !avatar) return;
    const isImage = avatar.tagName === 'IMG';
    markNeutralAvatarElement(avatar, false, false);

    let node = avatar.parentElement;
    let depth = 0;
    while (node && node !== document.body && depth < 5) {
      const isAvatarHost = node.matches(
        'a[data-user-card], a[href*="/u/"], .main-avatar, .avatar, .avatar-wrapper, ' +
        '.post-avatar, .topic-avatar, .user-image, .user-card-avatar, ' +
        '.user-profile-avatar, .collapsed-info'
      );
      if (isAvatarHost) markNeutralAvatarElement(node, true, isImage);
      hideDirectAvatarDecorations(node);

      // Discourse 的 avatar-flair 是 main-avatar 的同级节点。
      if (node.matches('a[data-user-card], a[href*="/u/"], .main-avatar, .avatar')) {
        for (const sibling of [node.previousElementSibling, node.nextElementSibling]) {
          if (!sibling?.matches(AVATAR_DECORATION_SELECTOR)) continue;
          if (sibling.querySelector('img.avatar, img.user-image, img[data-avatar-template], .avatar img')) {
            markNeutralAvatarElement(sibling, true, true);
          } else {
            hideElement(sibling, 'avatar-decoration');
          }
        }
      }

      if (node.matches('.post-avatar, .topic-avatar, .user-image, .user-card-avatar, .user-profile-avatar')) break;
      node = node.parentElement;
      depth++;
    }
  }

  function replaceAvatarImage(image, identity) {
    if (!image || image.nodeType !== Node.ELEMENT_NODE || image.closest('#' + UI_ID)) return;

    if (image.tagName === 'IMG') {
      setPatchedAttribute(image, 'src', 'src', identity.avatar);
      setPatchedAttribute(image, 'srcset', 'srcset', null);
      setPatchedAttribute(image, 'alt', 'alt', identity.alias);
      image.setAttribute('data-ldd-avatar-alias', identity.alias);
      addPatchedClass(image, 'ldd-dissolved-avatar');
      neutralizeAvatarAppearance(image);
      return;
    }

    const style = getComputedStyle(image);
    if ((style.backgroundImage && style.backgroundImage !== 'none') || image.hasAttribute('data-ldd-avatar-alias')) {
      setPatchedStyle(
        image,
        'backgroundImage',
        'background-image',
        'url("' + identity.avatar.replace(/"/g, '%22') + '")',
        'important'
      );
      image.setAttribute('data-ldd-avatar-alias', identity.alias);
      addPatchedClass(image, 'ldd-dissolved-avatar');
      neutralizeAvatarAppearance(image);
    }
  }

  function replaceAvatarsWithin(element, identity) {
    if (!runtime.state.config.replaceAvatars || !element) return;
    const avatars = new Set();
    if (element.matches?.('img.avatar, img.user-image, img[data-avatar-template], .avatar')) avatars.add(element);
    element.querySelectorAll?.('img.avatar, img.user-image, img[data-avatar-template], .avatar img, .avatar').forEach(item => avatars.add(item));
    avatars.forEach(avatar => replaceAvatarImage(avatar, identity));
  }

  function shouldReplaceIdentityText(element, username) {
    if (!element.matches('a, span, strong, b')) return false;
    if (element.hasAttribute('data-ldd-alias') || element.__lddOriginal?.textPatches?.some(record => record.key === 'identity')) return true;
    if (element.matches('aside.quote, article, .topic-list-item, .latest-topic-list-item, .fps-result, .search-result, .user-card, #user-card')) return false;
    if (element.matches('a.main-avatar, .topic-avatar a, .post-avatar a') && !String(element.textContent || '').trim()) return false;
    if (element.matches('.mention, [class*="mention"], .username, .full-name, .name, [class*="username"]')) return true;
    if (element.closest('.names, .user-profile-names, .user-card .names, #user-card .names, .topic-poster, .posters, .author, .search-result__author')) return true;
    if (element.matches('a.reply-to-tab')) return true;
    const visible = normalizeUsername(String(element.textContent || '').trim().replace(/^@/, ''));
    return Boolean(visible && visible === username);
  }

  function maskIdentityAttributes(element, identity) {
    if (!element || element.nodeType !== Node.ELEMENT_NODE) return;
    if (element.hasAttribute('title')) setPatchedAttribute(element, 'title', 'title', identity.alias);
    if (element.hasAttribute('aria-label')) setPatchedAttribute(element, 'ariaLabel', 'aria-label', identity.alias);
  }

  const DISSOLVE_ARTIFACT_SELECTOR = [
    '[data-ldd-alias]',
    '[data-ldd-avatar-alias]',
    '[data-ldd-hidden-kind="topic"]',
    '[data-ldd-hidden-kind="signature"]',
    '[data-ldd-hidden-kind="signature-separator"]',
    '[data-ldd-hidden-kind="identity-decoration"]',
    '[data-ldd-hidden-kind="avatar-decoration"]',
    '.ldd-dissolved-name',
    '.ldd-dissolved-avatar',
    '.ldd-neutral-avatar',
    '.ldd-neutral-avatar-host',
    '.ldd-clear-avatar-frame'
  ].join(',');

  const DECORATION_ARTIFACT_SELECTOR = [
    '[data-ldd-hidden-kind="identity-decoration"]',
    '[data-ldd-hidden-kind="avatar-decoration"]',
    '.ldd-neutral-avatar',
    '.ldd-neutral-avatar-host',
    '.ldd-clear-avatar-frame'
  ].join(',');

  function collectIncludingRoot(root, selector) {
    if (!root || root.nodeType !== Node.ELEMENT_NODE) return [];
    const result = [];
    if (root.matches(selector)) result.push(root);
    result.push(...root.querySelectorAll(selector));
    return result;
  }

  function restoreDissolveArtifactsWithin(root) {
    for (const element of collectIncludingRoot(root, DISSOLVE_ARTIFACT_SELECTOR)) restoreElement(element);
  }

  function restoreDecorationArtifactsWithin(root) {
    for (const element of collectIncludingRoot(root, DECORATION_ARTIFACT_SELECTOR)) restoreElement(element);
  }

  function restoreIdentityNeighborhood(carrier) {
    if (!carrier || carrier.nodeType !== Node.ELEMENT_NODE) return;
    restoreDissolveArtifactsWithin(carrier);
    let node = carrier;
    let depth = 0;
    while (node && node !== document.body && depth < 5) {
      if (
        node.matches?.('.ldd-neutral-avatar, .ldd-neutral-avatar-host, .ldd-clear-avatar-frame')
        || node.getAttribute?.('data-ldd-hidden-kind') === 'avatar-decoration'
        || node.getAttribute?.('data-ldd-hidden-kind') === 'identity-decoration'
      ) restoreElement(node);
      for (const sibling of [node.previousElementSibling, node.nextElementSibling]) {
        if (!sibling) continue;
        if (
          sibling.matches(DECORATION_ARTIFACT_SELECTOR)
          || sibling.matches(AVATAR_DECORATION_SELECTOR)
        ) restoreDecorationArtifactsWithin(sibling);
      }
      if (node.matches?.('article[data-post-id], .topic-post, .user-card, #user-card, .topic-list-item, .latest-topic-list-item')) break;
      node = node.parentElement;
      depth++;
    }
  }

  function targetedVisualContainer(element) {
    if (!element || element.nodeType !== Node.ELEMENT_NODE) return null;
    // class/style 只在帖子与用户卡的小范围内观察；列表依靠身份、头像和 childList 变化协调，
    // 避免长列表为每一行创建观察器。
    return element.closest('article[data-post-id], .topic-post, .user-card, #user-card');
  }

  function ensureTargetedVisualObserver(container) {
    if (!container || !container.isConnected || container === document.body || container.closest('#' + UI_ID)) return;
    if (runtime.visualObservers.has(container)) return;
    const observer = new MutationObserver(mutations => {
      if (runtime.suppressMutations) return;
      for (const mutation of mutations) {
        if (
          mutation.type === 'attributes'
          && !isExpectedPatchedAttributeMutation(mutation.target, mutation.attributeName)
        ) addScanRoot(mutation.target);
      }
      if (runtime.pendingRoots.size) queueScan();
    });
    observer.observe(container, {
      subtree: true,
      attributes: true,
      attributeFilter: ['class', 'style', 'hidden']
    });
    runtime.visualObservers.set(container, observer);
  }

  function containerHasDissolvedIdentity(container) {
    if (!container?.isConnected) return false;
    if (container.matches('.user-card, #user-card')) {
      const profile = container.querySelector('a[data-user-card], a[href^="/u/"], [data-username]');
      return shouldAnonymizeUsername(usernameOf(profile));
    }
    if (container.matches('article[data-post-id], .topic-post')) {
      const article = container.matches('article[data-post-id]')
        ? container
        : container.querySelector('article[data-post-id]') || container;
      return shouldAnonymizeUsername(usernameOf(postAuthor(article)));
    }
    return false;
  }

  function pruneTargetedVisualObservers() {
    for (const [container, observer] of Array.from(runtime.visualObservers.entries())) {
      if (container.isConnected && containerHasDissolvedIdentity(container)) continue;
      observer.disconnect();
      runtime.visualObservers.delete(container);
    }
  }

  function stopTargetedVisualObservers() {
    for (const observer of runtime.visualObservers.values()) observer.disconnect();
    runtime.visualObservers.clear();
  }

  function transientIdentityContainer(element) {
    if (!element || element.nodeType !== Node.ELEMENT_NODE) return null;
    if (element.matches('a.reply-to-tab, .discourse-boosts__bubble')) return element;
    return element.closest('.discourse-boosts__bubble');
  }

  function setTransientIdentityState(element, state) {
    const container = transientIdentityContainer(element);
    if (!container) return;
    if (container.getAttribute('data-ldd-identity-state') !== state) {
      container.setAttribute('data-ldd-identity-state', state);
    }
  }

  function scanIdentities(root) {
    const selector = '[data-user-card], [data-username], a[href*="/u/"], a.reply-to-tab, .discourse-boosts__bubble';
    const elements = collect(root, selector);

    for (const element of elements) {
      const isBoostBubble = element.matches('.discourse-boosts__bubble');
      const boostAuthor = isBoostBubble
        ? element.querySelector('[data-user-card], [data-username], a[href*="/u/"]')
        : null;
      const username = normalizeUsername(
        (boostAuthor && usernameOf(boostAuthor)) || usernameOf(element) || element.__lddBoostUsername
      );
      if (username && isBoostBubble) element.__lddBoostUsername = username;
      if (username && element.matches('a.reply-to-tab')) element.__lddReplyUsername = username;
      recordVisibleRealUsername(username, element);
      recordIdentityDisplayNames(username, boostAuthor || element);
      if (!username) {
        setTransientIdentityState(element, 'clear');
        continue;
      }
      if (!shouldAnonymizeUsername(username)) {
        restoreIdentityNeighborhood(element);
        setTransientIdentityState(element, 'clear');
        continue;
      }
      const carrier = element.matches('a, span, strong, b, img, picture, .avatar, .username, .name, .discourse-boosts__bubble');
      if (!carrier) continue;
      const replaceText = shouldReplaceIdentityText(element, username);
      const hasAvatar = Boolean(
        element.matches?.('img.avatar, img.user-image, img[data-avatar-template], .avatar')
        || element.querySelector?.('img.avatar, img.user-image, img[data-avatar-template], .avatar img, .avatar')
      );
      if (!replaceText && !hasAvatar) {
        restoreIdentityNeighborhood(element);
        setTransientIdentityState(element, 'masked');
        continue;
      }
      const identity = identityFor(username, element);
      markTriggered(element);
      maskIdentityAttributes(element, identity);
      if (replaceText) replaceTextElement(element, identity, username);
      else restoreTextPatchKey(element, 'identity');
      if (hasAvatar) replaceAvatarsWithin(element, identity);
      setTransientIdentityState(element, 'masked');
      ensureTargetedVisualObserver(targetedVisualContainer(element));
    }
  }

  function escapedUsernamePattern() {
    const names = Array.from(anonymizedUsernames())
      .filter(Boolean)
      .sort((a, b) => b.length - a.length)
      .map(value => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    if (!names.length) return null;
    return new RegExp('(^|[^A-Za-z0-9_-])@(' + names.join('|') + ')(?![A-Za-z0-9_-])', 'gi');
  }

  function shouldSkipPlainMention(node) {
    const parent = node?.parentElement;
    return !parent || parent.closest(
      'script, style, textarea, input, code, pre, #' + UI_ID + ', [data-ldd-alias]'
    );
  }

  function replacePlainMentionNode(node) {
    if (node.nodeType !== Node.TEXT_NODE || shouldSkipPlainMention(node)) return;
    const owner = node.parentElement;
    const text = sourceTextForPatch(owner, 'plain-mention', node);
    if (!text.includes('@')) return;
    const regex = escapedUsernamePattern();
    if (!regex) return;

    let changed = false;
    const replaced = text.replace(regex, (whole, prefix, rawUsername) => {
      const username = normalizeUsername(rawUsername);
      if (!shouldAnonymizeUsername(username)) return whole;
      const identity = identityFor(username, owner);
      changed = true;
      markTriggered(owner);
      recordExposedIdentity(username, identity, owner);
      return (prefix || '') + '@' + identity.alias;
    });
    if (!changed || replaced === text) return;
    patchTextNode(owner, 'plain-mention', node, replaced);
    addPatchedClass(owner, 'ldd-dissolved-name');
  }

  function scanPlainMentions(root) {
    if (!runtime.dissolvedSet.size && !runtime.state.config.pureMode) return;
    const roots = new Set(collect(root, [
      '.cooked', '.excerpt', '.topic-excerpt', '.fps-result', '.search-result',
      '.user-stream-item', '.activity-stream .item', '.bookmark-list-item',
      '.discourse-boosts__cooked'
    ].join(',')));
    if (root?.nodeType === Node.ELEMENT_NODE) {
      const closest = root.closest('.cooked, .excerpt, .topic-excerpt, .fps-result, .search-result, .user-stream-item, .activity-stream .item, .bookmark-list-item, .discourse-boosts__cooked');
      if (closest) roots.add(closest);
    }
    for (const textRoot of roots) {
      const walker = document.createTreeWalker(textRoot, NodeFilter.SHOW_TEXT, {
        acceptNode(node) {
          return String(node.nodeValue || '').includes('@') && !shouldSkipPlainMention(node)
            ? NodeFilter.FILTER_ACCEPT
            : NodeFilter.FILTER_REJECT;
        }
      });
      const nodes = [];
      while (walker.nextNode()) nodes.push(walker.currentNode);
      nodes.forEach(replacePlainMentionNode);
    }
  }

  function scanQuoteAuthors(root) {
    for (const quote of collect(root, 'aside.quote[data-username], .quote[data-username]')) {
      const username = normalizeUsername(quote.getAttribute('data-username'));
      const title = quote.querySelector('.title');
      if (!title) continue;
      if (!shouldAnonymizeUsername(username)) {
        restoreTextPatchKey(title, 'quote-author');
        title.removeAttribute('data-ldd-alias');
        title.classList.remove('ldd-dissolved-name');
        continue;
      }
      if (title.querySelector('[data-user-card], [data-username], a[href*="/u/"]')) continue;
      const identity = identityFor(username, quote);
      const walker = document.createTreeWalker(title, NodeFilter.SHOW_TEXT);
      const nodes = [];
      while (walker.nextNode()) nodes.push(walker.currentNode);
      const pattern = new RegExp(username.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      const target = nodes.find(node => pattern.test(sourceTextForPatch(title, 'quote-author', node)));
      if (!target) continue;
      const source = sourceTextForPatch(title, 'quote-author', target);
      patchTextNode(title, 'quote-author', target, source.replace(pattern, identity.alias));
      title.setAttribute('data-ldd-alias', identity.alias);
      addPatchedClass(title, 'ldd-dissolved-name');
      markTriggered(title);
      recordExposedIdentity(username, identity, title);
    }
  }

  function notificationContainer(label) {
    return label?.closest?.(
      '.notification, .notification-list-item, .user-notification, ' +
      '[data-notification-id], li'
    ) || null;
  }

  function notificationIdentityCarrier(label) {
    if (usernameOf(label)) return label;
    const container = notificationContainer(label);
    if (!container) return null;
    return container.querySelector(
      '[data-user-card], [data-username], a[href*="/u/"], ' +
      'img.avatar, img.user-image, img[data-avatar-template]'
    );
  }

  function notificationUsername(label) {
    const cachedCarrier = label?.__lddNotificationCarrier;
    const cached = normalizeUsername(label?.__lddNotificationUsername);
    if (cached && cachedCarrier?.isConnected && notificationContainer(label)?.contains(cachedCarrier)) {
      return cached;
    }
    const carrier = notificationIdentityCarrier(label);
    const username = usernameOf(carrier);
    if (username) {
      label.__lddNotificationUsername = username;
      label.__lddNotificationCarrier = carrier;
      const container = notificationContainer(label);
      if (container) {
        container.__lddNotificationUsername = username;
        container.__lddNotificationCarrier = carrier;
      }
    }
    return username;
  }

  function scanNotificationLabels(root) {
    const labels = collect(root,
      '.notification span.item-label, .notification .item-label, ' +
      '.notification-list-item span.item-label, .user-notification span.item-label, ' +
      '[data-notification-id] span.item-label'
    );
    for (const label of labels) {
      const nodes = visibleTextNodes(label);
      if (!nodes.length) continue;
      const sources = nodes.map(node => sourceTextForPatch(label, 'notification-label', node));
      const combined = sources.join('').trim();
      const names = new Set(anonymizedUsernames());
      const associatedUsername = notificationUsername(label);
      if (associatedUsername) {
        recordVisibleRealUsername(associatedUsername, label);
        recordIdentityDisplayNames(associatedUsername, label);
      }
      const mappedDisplayUsername = displayNameUsername(label);
      const directUsername = associatedUsername || mappedDisplayUsername;
      if (directUsername) names.add(directUsername);
      let directIdentity = null;
      if (directUsername && shouldAnonymizeUsername(directUsername) && combined) {
        directIdentity = identityFor(directUsername, label);
      }
      if (runtime.state.config.pureMode && /^[A-Za-z0-9_.-]{1,40}$/.test(combined)) {
        const candidate = normalizeUsername(combined);
        names.add(candidate);
        recordVisibleRealUsername(candidate, label);
      }
      const escaped = Array.from(names)
        .filter(Boolean)
        .sort((a, b) => b.length - a.length)
        .map(value => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
      if (!escaped.length) {
        if (label.__lddOriginal?.textPatches?.some(record => record.key === 'notification-label')) {
          restoreElement(label);
        }
        continue;
      }
      const pattern = new RegExp('(^|[^A-Za-z0-9_.-])(' + escaped.join('|') + ')(?![A-Za-z0-9_.-])', 'gi');
      let changed = false;
      const cleaned = directIdentity
        ? [directIdentity.alias, ...sources.slice(1).map(() => '')]
        : sources.map(source => source.replace(pattern, (whole, prefix, rawUsername) => {
          const username = normalizeUsername(rawUsername);
          if (!shouldAnonymizeUsername(username)) return whole;
          const identity = identityFor(username, label);
          changed = true;
          markTriggered(label);
          recordExposedIdentity(username, identity, label);
          return (prefix || '') + identity.alias;
        }));
      if (directIdentity) {
        changed = cleaned.join('') !== sources.join('');
        markTriggered(label);
        recordExposedIdentity(directUsername, directIdentity, label);
        replaceAvatarsWithin(notificationIdentityCarrier(label), directIdentity);
      }
      if (!changed || cleaned.join('') === sources.join('')) {
        if (label.__lddOriginal?.textPatches?.some(record => record.key === 'notification-label')) {
          restoreElement(label);
        }
        continue;
      }
      pruneTextPatchKey(label, 'notification-label', nodes);
      nodes.forEach((node, index) => patchTextNode(label, 'notification-label', node, cleaned[index]));
      addPatchedClass(label, 'ldd-dissolved-name');
    }
  }

  function postAuthor(post) {
    return post?.querySelector(
      '.topic-avatar a.main-avatar[data-user-card], ' +
      '.post-avatar a.main-avatar[data-user-card], ' +
      '.topic-meta-data .names a[data-user-card], ' +
      '.names a[data-user-card], ' +
      'a[data-user-card]'
    );
  }

  function hideElement(element, kind) {
    if (!element || element.nodeType !== Node.ELEMENT_NODE) return;
    const currentDisplay = element.style.getPropertyValue('display');
    const currentPriority = element.style.getPropertyPriority('display');
    if (
      element.getAttribute('data-ldd-hidden-kind') === kind
      && element.hidden
      && currentDisplay === 'none'
      && currentPriority === 'important'
    ) return;

    const original = ensureOriginalState(element);
    const applied = element.__lddApplied;
    if (!('hidden' in original)) original.hidden = element.hidden;
    else if ('hidden' in applied && element.hidden !== applied.hidden) original.hidden = element.hidden;
    if (!('display' in original)) {
      original.display = currentDisplay;
      original.displayPriority = currentPriority;
    } else if ('display' in applied && (currentDisplay !== applied.display.value || currentPriority !== applied.display.priority)) {
      original.display = currentDisplay;
      original.displayPriority = currentPriority;
    }
    applied.hidden = true;
    applied.display = { value: 'none', priority: 'important' };
    element.hidden = true;
    element.style.setProperty('display', 'none', 'important');
    element.setAttribute('data-ldd-hidden-kind', kind);
  }


  const POST_IDENTITY_DECORATION_SELECTOR = [
    '.topic-avatar .avatar-flair',
    '.post-avatar .avatar-flair',
    '.topic-avatar [class*="avatar-frame"]',
    '.post-avatar [class*="avatar-frame"]',
    '.topic-avatar [class*="avatar-border"]',
    '.post-avatar [class*="avatar-border"]',
    '.topic-meta-data .user-title',
    '.names .user-title',
    '.topic-meta-data [class*="user-title--"]',
    '.names [class*="user-title--"]',
    '.topic-meta-data .poster-icon-container',
    '.names .poster-icon-container',
    '.topic-meta-data .user-badge-buttons',
    '.names .user-badge-buttons',
    '.topic-meta-data [class*="user-badge-button-"]',
    '.names [class*="user-badge-button-"]',
    '.topic-meta-data .user-card-badge-link',
    '.names .user-card-badge-link',
    '.topic-meta-data .user-status-message-wrap',
    '.names .user-status-message-wrap',
    '.names .d-icon-shield-halved',
    '.names .d-icon-shield',
    '.names .poster-icon'
  ].join(',');

  const CARD_IDENTITY_DECORATION_SELECTOR = [
    '.avatar-flair',
    '[class*="avatar-frame"]',
    '[class*="avatar-border"]',
    '.user-title',
    '[class*="user-title--"]',
    '.poster-icon-container',
    '.poster-icon',
    '.user-badge-buttons',
    '[class*="user-badge-button-"]',
    '.user-card-badge-link',
    '.user-card-badge',
    '[class*="card-badge"]',
    '.user-status-message-wrap'
  ].join(',');

  function hideIdentityDecorationsWithin(scope, selector) {
    if (!scope || scope.nodeType !== Node.ELEMENT_NODE) return;
    for (const decoration of scope.querySelectorAll(selector)) {
      // 不要误伤包含实际头像的自定义框容器。
      if (decoration.querySelector?.('img.avatar, img.user-image, img[data-avatar-template], .avatar img')) {
        markNeutralAvatarElement(decoration, true, true);
        hideDirectAvatarDecorations(decoration);
        continue;
      }
      hideElement(decoration, 'identity-decoration');
    }
  }

  function scanIdentityDecorations(root) {
    const carriers = collect(root, '[data-user-card], [data-username], a[href*="/u/"]');
    for (const carrier of carriers) {
      const username = usernameOf(carrier);
      if (!runtime.state.config.hideIdentityDecorations || !shouldAnonymizeUsername(username)) {
        restoreIdentityNeighborhood(carrier);
        continue;
      }
      const avatars = new Set();
      if (carrier.matches('img.avatar, img.user-image, img[data-avatar-template], .avatar')) avatars.add(carrier);
      carrier.querySelectorAll?.('img.avatar, img.user-image, img[data-avatar-template], .avatar img, .avatar')
        .forEach(avatar => avatars.add(avatar));
      avatars.forEach(neutralizeAvatarAppearance);
      hideDirectAvatarDecorations(carrier);
      ensureTargetedVisualObserver(targetedVisualContainer(carrier));
    }

    for (const post of collect(root, 'article[data-post-id]')) {
      const username = usernameOf(postAuthor(post));
      const container = post.closest('.topic-post') || post;
      if (!runtime.state.config.hideIdentityDecorations || !shouldAnonymizeUsername(username)) {
        restoreDecorationArtifactsWithin(container);
        continue;
      }
      hideIdentityDecorationsWithin(container, POST_IDENTITY_DECORATION_SELECTOR);
      container.querySelectorAll('img.avatar, img.user-image, img[data-avatar-template]').forEach(avatar => {
        const carrier = avatar.closest('[data-user-card], [data-username], a[href*="/u/"]');
        if (usernameOf(carrier) === username) neutralizeAvatarAppearance(avatar);
      });
      ensureTargetedVisualObserver(container);
    }

    for (const card of collect(root, '.user-card, #user-card')) {
      const profile = card.querySelector('a[data-user-card], a[href^="/u/"], [data-username]');
      const username = usernameOf(profile);
      if (!runtime.state.config.hideIdentityDecorations || !shouldAnonymizeUsername(username)) {
        restoreDecorationArtifactsWithin(card);
        continue;
      }
      hideIdentityDecorationsWithin(card, CARD_IDENTITY_DECORATION_SELECTOR);
      card.querySelectorAll('img.avatar, img.user-image, img[data-avatar-template]').forEach(neutralizeAvatarAppearance);
    }
  }

  const SIGNATURE_SELECTOR = '.signature-img, .user-signature';

  function signaturePost(signature) {
    return signature?.closest(
      'article[data-post-id], .topic-post, article, [data-post-id]'
    );
  }

  function hideSignatureBlock(signature) {
    hideElement(signature, 'signature');
    // discourse-signatures 将分隔线作为签名节点的前一个同级元素渲染。
    const separator = signature.previousElementSibling;
    if (separator?.tagName === 'HR') hideElement(separator, 'signature-separator');
  }

  function signatureShouldBeHidden(signature) {
    const post = signaturePost(signature);
    const username = usernameOf(postAuthor(post));
    return runtime.state.config.hideSignatures && shouldAnonymizeUsername(username);
  }

  function scanSignatures(root) {
    const signatures = new Set(collect(root, SIGNATURE_SELECTOR));
    for (const signature of signatures) {
      if (signatureShouldBeHidden(signature)) {
        hideSignatureBlock(signature);
        ensureTargetedVisualObserver(targetedVisualContainer(signaturePost(signature) || signature));
      } else {
        if (signature.getAttribute('data-ldd-hidden-kind') === 'signature') restoreElement(signature);
        const separator = signature.previousElementSibling;
        if (separator?.getAttribute('data-ldd-hidden-kind') === 'signature-separator') restoreElement(separator);
      }
    }

    // 处理框架复用：签名节点被移除、改类名，或作者改变后，不能留下孤立隐藏状态。
    for (const hiddenSignature of collect(root, '[data-ldd-hidden-kind="signature"]')) {
      if (!hiddenSignature.matches(SIGNATURE_SELECTOR) || !signatureShouldBeHidden(hiddenSignature)) {
        restoreElement(hiddenSignature);
      }
    }
    for (const separator of collect(root, '[data-ldd-hidden-kind="signature-separator"]')) {
      const signature = separator.nextElementSibling;
      if (!signature?.matches(SIGNATURE_SELECTOR) || !signatureShouldBeHidden(signature)) {
        restoreElement(separator);
      }
    }
  }

  function firstTopicPoster(row) {
    return row?.querySelector(
      '.posters a[data-user-card], ' +
      '.topic-list-data.posters a[data-user-card], ' +
      'td.posters a[data-user-card], ' +
      '.topic-poster a[data-user-card], ' +
      '.author a[data-user-card], ' +
      '.posters a[href*="/u/"], ' +
      '.topic-poster a[href*="/u/"], ' +
      '.author a[href*="/u/"]'
    );
  }

  function searchResultPoster(result) {
    return result?.querySelector(
      '.author [data-user-card], .author [data-username], .author a[href*="/u/"], '
      + '.search-result__author [data-user-card], .search-result__author a[href*="/u/"], '
      + '.fps-result .author a[href*="/u/"]'
    );
  }

  function scanHiddenTopics(root) {
    for (const row of collect(root, '.topic-list-item, .latest-topic-list-item')) {
      const author = firstTopicPoster(row);
      const shouldHide = runtime.state.config.hideDissolvedTopics
        && !runtime.state.config.pureMode
        && runtime.dissolvedSet.has(usernameOf(author));
      if (shouldHide) hideElement(row, 'topic');
      else if (row.getAttribute('data-ldd-hidden-kind') === 'topic') restoreElement(row);
    }

    for (const result of collect(root, '.fps-result, .search-result')) {
      const author = searchResultPoster(result);
      const shouldHide = runtime.state.config.hideDissolvedTopics
        && !runtime.state.config.pureMode
        && runtime.dissolvedSet.has(usernameOf(author));
      if (shouldHide) hideElement(result, 'topic');
      else if (result.getAttribute('data-ldd-hidden-kind') === 'topic') restoreElement(result);
    }
  }

  const TITLE_PREFIX_PATTERN = /^\s*(?:(?:\([^\)\r\n]{0,30}\)|（[^）\r\n]{0,30}）|﹙[^﹚\r\n]{0,30}﹚|\[[^\]\r\n]{0,30}\]|［[^］\r\n]{0,30}］|【[^】\r\n]{0,30}】|〔[^〕\r\n]{0,30}〕|〖[^〗\r\n]{0,30}〗|〘[^〙\r\n]{0,30}〙|〚[^〛\r\n]{0,30}〛|﹝[^﹞\r\n]{0,30}﹞|\{[^\}\r\n]{0,30}\}|｛[^｝\r\n]{0,30}｝|﹛[^﹜\r\n]{0,30}﹜|《[^》\r\n]{0,30}》|〈[^〉\r\n]{0,30}〉|「[^」\r\n]{0,30}」|『[^』\r\n]{0,30}』)\s*)+/u;

  function emojiClean(value) {
    try {
      return String(value || '').replace(/[\p{Extended_Pictographic}\p{Emoji_Presentation}\uFE0F\u200D]/gu, '');
    } catch (_) {
      return String(value || '').replace(/[\u2600-\u27BF\u{1F300}-\u{1FAFF}\uFE0F\u200D]/gu, '');
    }
  }

  function titleSourceNodes(title) {
    const walker = document.createTreeWalker(title, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        return node.parentElement?.closest('svg, script, style')
          ? NodeFilter.FILTER_REJECT
          : NodeFilter.FILTER_ACCEPT;
      }
    });
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    return nodes;
  }

  function titleTopicAuthor(title) {
    const listRow = title.closest('.topic-list-item, .latest-topic-list-item');
    if (listRow) return firstTopicPoster(listRow);

    const searchResult = title.closest('.fps-result, .search-result');
    if (searchResult) return searchResultPoster(searchResult);

    if (!title.closest('#topic-title, h1[data-topic-id]')) return null;
    const firstPost = document.querySelector(
      'article[data-post-number="1"], article#post_1, #post_1 article[data-post-id], '
      + '.topic-post:first-of-type article[data-post-id], article[data-post-id]'
    );
    return postAuthor(firstPost);
  }

  function scanTitles(root) {
    const selector = [
      '.topic-list-item a.title',
      '.topic-list-item a.raw-topic-link',
      '.latest-topic-list-item a.title',
      '.latest-topic-list-item a.raw-topic-link',
      '.fps-result .topic-title a',
      '.search-result .topic-title a',
      '#topic-title h1 a',
      '#topic-title .fancy-title',
      'h1[data-topic-id] a'
    ].join(',');

    const titles = new Set(collect(root, selector));
    if (currentTopicId()) {
      document.querySelectorAll('#topic-title h1 a, #topic-title .fancy-title, h1[data-topic-id] a')
        .forEach(title => titles.add(title));
    }

    for (const title of titles) {
      if (title.closest('#' + UI_ID)) continue;
      const author = titleTopicAuthor(title);
      const shouldClean = runtime.state.config.pureMode || (
        runtime.state.config.cleanTopicTitles
        && runtime.dissolvedSet.has(usernameOf(author))
      );
      if (!shouldClean) {
        if (title.classList.contains('ldd-cleaned-title') || title.__lddOriginal?.textPatches) {
          restoreElement(title);
        }
        continue;
      }
      const nodes = titleSourceNodes(title);
      if (!nodes.length) continue;
      const sources = nodes.map(node => sourceTextForPatch(title, 'title-clean', node));
      const combined = sources.join('');
      const prefixMatch = combined.match(TITLE_PREFIX_PATTERN);
      let remainingPrefix = prefixMatch ? prefixMatch[0].length : 0;
      const cleanedParts = sources.map(source => {
        let value = source;
        if (remainingPrefix > 0) {
          const remove = Math.min(remainingPrefix, value.length);
          value = value.slice(remove);
          remainingPrefix -= remove;
        }
        return emojiClean(value).replace(/[ \t]{2,}/g, ' ');
      });
      const firstNonEmpty = cleanedParts.findIndex(part => part.length > 0);
      if (firstNonEmpty >= 0) cleanedParts[firstNonEmpty] = cleanedParts[firstNonEmpty].replace(/^\s+/, '');
      let lastNonEmpty = -1;
      for (let index = cleanedParts.length - 1; index >= 0; index--) {
        if (cleanedParts[index].length > 0) { lastNonEmpty = index; break; }
      }
      if (lastNonEmpty >= 0) cleanedParts[lastNonEmpty] = cleanedParts[lastNonEmpty].replace(/\s+$/, '');
      if (cleanedParts.join('') === combined) continue;
      pruneTextPatchKey(title, 'title-clean', nodes);
      nodes.forEach((node, index) => patchTextNode(title, 'title-clean', node, cleanedParts[index]));
      addPatchedClass(title, 'ldd-cleaned-title');
    }
  }


  function assignUserCardScopes(root) {
    for (const card of collect(root, '.user-card, #user-card')) {
      const profile = card.querySelector('a[data-user-card], a[href^="/u/"], [data-username]');
      const username = usernameOf(profile);
      const context = runtime.userCardContext;
      const desiredScope = context
        && context.username === username
        && Date.now() - context.at < 10000
        ? context.scope
        : '';
      if (desiredScope) card.setAttribute('data-ldd-scope', desiredScope);
      else card.removeAttribute('data-ldd-scope');
    }
  }

  function scanUserCards(root) {
    for (const card of collect(root, '.user-card, #user-card')) {
      const profile = card.querySelector('a[data-user-card], a[href^="/u/"], [data-username]');
      const username = usernameOf(profile);
      let actions = card.querySelector('.ldd-card-actions');
      if (!username) {
        actions?.remove();
        card.removeAttribute('data-ldd-scope');
        restoreDissolveArtifactsWithin(card);
        continue;
      }

      if (!actions) {
        const host = card.querySelector('.usercard-controls, .user-card-controls, .card-row .controls, .names, .card-content') || card;
        actions = document.createElement('div');
        actions.className = 'ldd-card-actions';
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'ldd-card-dissolve';
        button.addEventListener('click', event => {
          event.preventDefault();
          event.stopPropagation();
          event.stopImmediatePropagation();
          const currentUsername = normalizeUsername(actions.dataset.username);
          if (!currentUsername) return;
          toggleUserInList('dissolvedUsers', currentUsername);
          dismissUserCard(card);
        });
        actions.appendChild(button);
        host.appendChild(actions);
      }

      actions.dataset.username = username;
      const button = actions.querySelector('.ldd-card-dissolve');
      if (button) button.textContent = runtime.dissolvedSet.has(username) ? '解除溶解' : '溶解此人';
      if (!shouldAnonymizeUsername(username)) {
        restoreDissolveArtifactsWithin(card);
        // 卡片复用时先撤销旧主人的全部状态，再重放卡片内仍应溶解的其他身份。
        scanIdentities(card);
      }
    }
  }

  function dismissUserCard(card) {
    card.remove();
    document.querySelector('.card-cloak, .user-card-cloak')?.dispatchEvent(
      new MouseEvent('click', { bubbles: true, cancelable: true })
    );
  }

  function toggleUserInList(listKey, username) {
    const normalized = normalizeUsername(username);
    const list = runtime.state[listKey];
    const index = list.indexOf(normalized);
    if (index >= 0) list.splice(index, 1);
    else list.push(normalized);
    rebuildSets();
    saveState([listKey]);
    restoreAll();
    queueScan(document);
    renderUi();
    showToast(index >= 0 ? '已解除。' : '已加入。');
  }

  function scan(root) {
    if (runtime.scanning) return;
    runtime.scanning = true;
    try {
      ensureHeaderButton();
      assignUserCardScopes(root);
      if (!runtime.state.config.enabled) return;
      const epochReset = ensureTimeEpoch();
      if (epochReset) restoreAll();
      scanHiddenTopics(root);
      scanIdentities(root);
      scanIdentityDecorations(root);
      scanPlainMentions(root);
      scanQuoteAuthors(root);
      scanNotificationLabels(root);
      scanSignatures(root);
      scanTitles(root);
      scanUserCards(root);
      pruneTargetedVisualObservers();
    } finally {
      runtime.scanning = false;
    }
  }

  function restoreElement(element) {
    const original = element.__lddOriginal;
    const applied = element.__lddApplied || Object.create(null);
    if (!original) return;

    withMutationSuppressed(() => {
      if (Array.isArray(original.textPatches)) {
        for (let index = original.textPatches.length - 1; index >= 0; index--) {
          const record = original.textPatches[index];
          if (record.node?.isConnected && record.node.nodeValue === record.applied) {
            record.node.nodeValue = record.original;
          }
        }
      }

      for (const [key, name] of [['title', 'title'], ['ariaLabel', 'aria-label'], ['src', 'src'], ['srcset', 'srcset'], ['alt', 'alt']]) {
        if (!(key in original)) continue;
        const current = element.getAttribute(name);
        if (!(key in applied) || current === applied[key]) restoreAttribute(element, name, original[key]);
      }
      if ('backgroundImage' in original) {
        const patch = original.backgroundImage;
        const current = element.style.getPropertyValue('background-image');
        const currentPriority = element.style.getPropertyPriority('background-image');
        const expected = applied.backgroundImage;
        if (!expected || (current === expected.value && currentPriority === expected.priority)) {
          if (patch.value) element.style.setProperty('background-image', patch.value, patch.priority || '');
          else element.style.removeProperty('background-image');
        }
      }
      if ('hidden' in original && (!('hidden' in applied) || element.hidden === applied.hidden)) {
        element.hidden = original.hidden;
      }
      if ('display' in original) {
        const expected = applied.display;
        const currentDisplay = element.style.getPropertyValue('display');
        const currentPriority = element.style.getPropertyPriority('display');
        if (!expected || (currentDisplay === expected.value && currentPriority === expected.priority)) {
          if (original.display) element.style.setProperty('display', original.display, original.displayPriority || '');
          else element.style.removeProperty('display');
        }
      }

      element.classList.remove(
        'ldd-dissolved-name', 'ldd-dissolved-avatar', 'ldd-cleaned-title',
        'ldd-neutral-avatar', 'ldd-neutral-avatar-host', 'ldd-clear-avatar-frame'
      );
      element.removeAttribute('data-ldd-alias');
      element.removeAttribute('data-ldd-avatar-alias');
      element.removeAttribute('data-ldd-hidden-kind');
      element.removeAttribute('data-ldd-mutated');
      element.removeAttribute('data-ldd-identity-state');
      delete element.__lddOriginal;
      delete element.__lddApplied;
    });
  }

  function restoreAttribute(element, name, value) {
    if (value === null || value === undefined) element.removeAttribute(name);
    else element.setAttribute(name, value);
  }

  function syncActiveMarker() {
    document.documentElement?.toggleAttribute('data-ldd-active', runtime.state.config.enabled);
  }

  function restoreAll() {
    stopTargetedVisualObservers();
    document.querySelectorAll('[data-ldd-mutated]').forEach(restoreElement);
    document.querySelectorAll('[data-ldd-identity-state]').forEach(element => {
      element.removeAttribute('data-ldd-identity-state');
    });
    document.querySelectorAll('.ldd-card-actions').forEach(element => element.remove());
    runtime.exposedAliases.clear();
    runtime.visibleRealUsernames.clear();
    runtime.visibleDisplayNames.clear();
  }

  function addScanRoot(root) {
    if (!root) return;
    if (root === document || root.nodeType === Node.DOCUMENT_NODE) {
      runtime.pendingRoots.clear();
      runtime.pendingRoots.add(document);
      return;
    }
    const element = root.nodeType === Node.TEXT_NODE ? root.parentElement : root;
    if (!element || element.nodeType !== Node.ELEMENT_NODE || !element.isConnected) return;
    if (runtime.pendingRoots.has(document)) return;
    const context = element.closest(
      'article[data-post-id], .topic-post, .topic-list-item, .latest-topic-list-item, ' +
      '.fps-result, .search-result, .user-card, #user-card, .cooked, .excerpt, ' +
      '.topic-excerpt, #topic-title, .topic-title, .user-stream-item, ' +
      '.activity-stream .item, .bookmark-list-item, .signature-img, .user-signature'
      + ', .notification, .item-label, .reply-to-tab, .discourse-boosts__bubble'
    );
    runtime.pendingRoots.add(context || element);
  }

  function queueScan(root) {
    if (root) addScanRoot(root);
    if (runtime.scanQueued) return;
    runtime.scanQueued = true;
    requestAnimationFrame(() => {
      runtime.scanQueued = false;
      const roots = Array.from(runtime.pendingRoots);
      runtime.pendingRoots.clear();
      if (!roots.length) return;
      if (roots.includes(document)) {
        scan(document);
        return;
      }
      roots.filter(root => root.isConnected).forEach(scan);
    });
  }

  function isExpectedPatchedAttributeMutation(element, attributeName) {
    const applied = element?.__lddApplied;
    if (!element || !applied) {
      return attributeName === 'style'
        && element?.hasAttribute('data-ldd-hidden-kind')
        && element.hidden
        && element.style.getPropertyValue('display') === 'none';
    }
    const attributeKeys = {
      src: 'src', srcset: 'srcset', title: 'title',
      'aria-label': 'ariaLabel', alt: 'alt'
    };
    const key = attributeKeys[attributeName];
    if (key && key in applied) return element.getAttribute(attributeName) === applied[key];
    if (attributeName === 'class' && 'className' in applied) {
      return (element.getAttribute('class') || '') === applied.className;
    }
    if (attributeName === 'style') {
      const expected = applied.backgroundImage;
      const backgroundMatches = !expected || (
        element.style.getPropertyValue('background-image') === expected.value
        && element.style.getPropertyPriority('background-image') === expected.priority
      );
      const hiddenMatches = !element.hasAttribute('data-ldd-hidden-kind') || (
        element.hidden && element.style.getPropertyValue('display') === 'none'
      );
      return backgroundMatches && hiddenMatches;
    }
    if (attributeName === 'hidden' && element.hasAttribute('data-ldd-hidden-kind')) return element.hidden;
    return false;
  }

  function startObserver() {
    if (runtime.observer) return;
    runtime.observer = new MutationObserver(mutations => {
      if (runtime.suppressMutations) return;
      for (const mutation of mutations) {
        if (mutation.type === 'childList') {
          mutation.addedNodes.forEach(node => addScanRoot(node));
          if (mutation.addedNodes.length || mutation.removedNodes.length) addScanRoot(mutation.target);
          continue;
        }
        if (mutation.type === 'characterData') {
          addScanRoot(mutation.target.parentElement);
          continue;
        }
        if (
          mutation.type === 'attributes'
          && !isExpectedPatchedAttributeMutation(mutation.target, mutation.attributeName)
        ) addScanRoot(mutation.target);
      }
      if (runtime.pendingRoots.size) queueScan();
      else ensureHeaderButton();
    });
    runtime.observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
      attributeFilter: [
        'data-user-card', 'data-username', 'href', 'src', 'srcset',
        'title', 'aria-label', 'alt', 'data-topic-id'
      ]
    });
  }

  function redirectBlockedProfileIfNeeded() {
    if (!runtime.state.config.enabled || !isDissolvedProfileDestination(location.href)) return false;
    try { sessionStorage.setItem(PROFILE_BLOCK_FLAG, '1'); } catch (_) {}
    location.replace(location.origin + '/');
    return true;
  }

  function hookRouting() {
    if (runtime.routeHooked) return;
    runtime.routeHooked = true;
    const onRoute = () => {
      const href = location.href;
      if (href === runtime.lastLocation) return;
      runtime.lastLocation = href;
      if (redirectBlockedProfileIfNeeded()) return;
      runtime.pageGeneration++;
      runtime.activeTriggerNodes = new WeakSet();
      runtime.exposedAliases.clear();
      runtime.userCardContext = null;
      setTimeout(() => {
        restoreAll();
        queueScan(document);
      }, 0);
    };

    for (const method of ['pushState', 'replaceState']) {
      const original = history[method];
      history[method] = function () {
        const destination = arguments.length >= 3 ? arguments[2] : '';
        if (runtime.state.config.enabled && isDissolvedProfileDestination(destination)) {
          showToast('无法跳转，此人被溶解');
          return undefined;
        }
        const result = original.apply(this, arguments);
        onRoute();
        return result;
      };
    }
    window.addEventListener('popstate', onRoute);
    window.addEventListener('hashchange', onRoute);
    // 带 @grant 的用户脚本可能运行在隔离环境，页面自己的 History API 调用未必经过上面的包装。
    runtime.routeTimer = setInterval(onRoute, 500);
  }

  function shouldBlockDissolvedProfileNavigation(anchor, event) {
    if (!anchor || anchor.closest('#' + UI_ID)) return false;
    const username = profileUsernameFromDestination(anchor.getAttribute('href'));
    if (!username || !runtime.dissolvedSet.has(username)) return false;

    const insideUserCard = Boolean(anchor.closest('.user-card, #user-card'));
    const opensInlineCard = anchor.hasAttribute('data-user-card') && !insideUserCard;
    const modifiedNavigation = event.type === 'auxclick'
      || event.button > 0
      || event.ctrlKey
      || event.metaKey
      || event.shiftKey
      || event.altKey
      || anchor.target === '_blank';

    // 普通点击身份入口时交给 Discourse 展开页面内用户卡；
    // 其他点击方式以及用户卡内的主页入口都视为页面跳转。
    return !opensInlineCard || modifiedNavigation;
  }


  function captureUserCardContext(event) {
    const carrier = event.target?.closest?.('[data-user-card], [data-username], a[href*="/u/"]');
    if (!carrier || carrier.closest('.user-card, #user-card, #' + UI_ID)) return;
    const username = usernameOf(carrier);
    if (!username) return;
    runtime.userCardContext = {
      username,
      scope: scopeFor(carrier),
      at: Date.now()
    };
  }

  function interceptDissolvedProfileNavigation() {
    const handler = event => {
      if (!runtime.state.config.enabled) return;
      const anchor = event.target?.closest?.('a[href]');
      if (!shouldBlockDissolvedProfileNavigation(anchor, event)) return;

      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      showToast('无法跳转，此人被溶解');
    };
    document.addEventListener('pointerdown', captureUserCardContext, true);
    document.addEventListener('mouseover', captureUserCardContext, true);
    document.addEventListener('click', handler, true);
    document.addEventListener('auxclick', handler, true);
  }

  function iconSvg(enabled = true) {
    if (enabled) {
      return '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 2.4c2.9 4.1 6.7 7.5 6.7 12A6.7 6.7 0 1 1 5.3 14.4c0-4.5 3.8-7.9 6.7-12Zm0 5.1c-1.7 2.5-3.8 4.7-3.8 7a3.8 3.8 0 0 0 7.6 0c0-2.3-2.1-4.5-3.8-7Z"/></svg>';
    }
    return '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" d="M12 3.2c-2.8 3.9-6 7-6 11.1a6 6 0 0 0 12 0c0-4.1-3.2-7.2-6-11.1Z"/><path fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" d="M9.1 15.2a3 3 0 0 0 2.9 2.2"/></svg>';
  }

  function updateHeaderButtonState() {
    const button = document.getElementById(HEADER_BUTTON_ID);
    if (!button) return;
    const enabled = runtime.state.config.enabled;
    button.classList.toggle('is-enabled', enabled);
    button.classList.toggle('is-disabled', !enabled);
    const state = String(enabled);
    if (button.dataset.enabled !== state) button.innerHTML = iconSvg(enabled);
    button.dataset.enabled = state;
    const label = enabled ? '溶解计划已启用，点击打开设置' : '溶解计划已停用，点击打开设置';
    button.title = label;
    button.setAttribute('aria-label', label);
  }

  function ensureHeaderButton() {
    if (!document.body) return;
    if (document.getElementById(HEADER_BUTTON_ID)) {
      updateHeaderButtonState();
      return;
    }
    const host = document.querySelector(
      '#site-header .header-icons, #site-header .header-buttons, .d-header .header-icons, .d-header .header-buttons'
    );
    if (!host) return;
    const button = document.createElement('button');
    button.id = HEADER_BUTTON_ID;
    button.type = 'button';
    button.innerHTML = iconSvg(runtime.state.config.enabled);
    button.addEventListener('click', openUi);
    const userMenu = host.querySelector('.current-user, .user-menu, [data-user-card]');
    host.insertBefore(button, userMenu || null);
    updateHeaderButtonState();
  }

  function injectStyle() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      #${HEADER_BUTTON_ID}{display:inline-flex!important;align-items:center;justify-content:center;box-sizing:border-box;width:30px!important;min-width:30px!important;height:30px!important;margin:0 2px!important;padding:0!important;border:0!important;border-radius:8px;background:transparent!important;cursor:pointer}
      #${HEADER_BUTTON_ID}.is-enabled{color:#567fa7}
      #${HEADER_BUTTON_ID}.is-enabled:hover{color:#3f6d99}
      #${HEADER_BUTTON_ID}.is-disabled{color:#929aa2}
      #${HEADER_BUTTON_ID}.is-disabled:hover{color:#737c84}
      #${HEADER_BUTTON_ID} svg{width:19px;height:19px;display:block}
      .ldd-dissolved-name{font-weight:500!important;letter-spacing:.01em;text-decoration:none!important}
      .ldd-dissolved-avatar{object-fit:cover!important;background-size:cover!important;background-position:center!important;border-radius:50%!important}
      [data-ldd-active] a.reply-to-tab:not([data-ldd-identity-state]) img.avatar,[data-ldd-active] a.reply-to-tab:not([data-ldd-identity-state]) img.user-image,[data-ldd-active] a.reply-to-tab:not([data-ldd-identity-state]) img[data-avatar-template],[data-ldd-active] a.reply-to-tab:not([data-ldd-identity-state]) .avatar,
      [data-ldd-active] .discourse-boosts__bubble:not([data-ldd-identity-state]) img.avatar,[data-ldd-active] .discourse-boosts__bubble:not([data-ldd-identity-state]) img.user-image,[data-ldd-active] .discourse-boosts__bubble:not([data-ldd-identity-state]) img[data-avatar-template],[data-ldd-active] .discourse-boosts__bubble:not([data-ldd-identity-state]) .avatar,
      .discourse-boosts__bubble[data-ldd-identity-state="masked"] img.avatar:not([data-ldd-avatar-alias]),.discourse-boosts__bubble[data-ldd-identity-state="masked"] img.user-image:not([data-ldd-avatar-alias]),.discourse-boosts__bubble[data-ldd-identity-state="masked"] img[data-avatar-template]:not([data-ldd-avatar-alias]),.discourse-boosts__bubble[data-ldd-identity-state="masked"] .avatar:not([data-ldd-avatar-alias]):not(:has([data-ldd-avatar-alias])),
      a.reply-to-tab[data-ldd-identity-state="masked"] img.avatar:not([data-ldd-avatar-alias]),a.reply-to-tab[data-ldd-identity-state="masked"] img.user-image:not([data-ldd-avatar-alias]),a.reply-to-tab[data-ldd-identity-state="masked"] img[data-avatar-template]:not([data-ldd-avatar-alias]),a.reply-to-tab[data-ldd-identity-state="masked"] .avatar:not([data-ldd-avatar-alias]):not(:has([data-ldd-avatar-alias])){visibility:hidden!important}
      [data-ldd-mutated].ldd-neutral-avatar,[data-ldd-mutated].ldd-neutral-avatar-host{border:none!important;box-shadow:none!important;outline:none!important;animation:none!important;filter:none!important;text-shadow:none!important}
      [data-ldd-mutated].ldd-neutral-avatar-host{background-color:transparent!important}
      [data-ldd-mutated].ldd-clear-avatar-frame{background-image:none!important}
      [data-ldd-mutated].ldd-neutral-avatar-host::before,[data-ldd-mutated].ldd-neutral-avatar-host::after{content:none!important;display:none!important;border:0!important;box-shadow:none!important;background:none!important;animation:none!important;filter:none!important}
      .ldd-card-actions{display:flex;gap:7px;flex-wrap:wrap;margin:8px 0 2px}
      .ldd-card-actions button{min-height:30px;padding:5px 10px;border:0;border-radius:7px;color:#fff;font:12px/1.2 Arial,"PingFang SC","Microsoft YaHei",sans-serif;cursor:pointer}
      .ldd-card-dissolve{background:#648bb2}
      .ldd-card-actions button:hover{filter:brightness(.94)}
      #${UI_ID}{position:fixed;z-index:100000;inset:0;display:none;align-items:center;justify-content:center;padding:16px;font-family:Arial,"PingFang SC","Microsoft YaHei",sans-serif;color:#26384a}
      #${UI_ID}.is-open{display:flex}
      #${UI_ID} .ldd-backdrop{position:absolute;inset:0;background:rgba(20,30,40,.38);backdrop-filter:blur(2px)}
      #${UI_ID} .ldd-dialog{position:relative;width:min(560px,100%);max-height:min(760px,calc(100vh - 32px));overflow:auto;border-radius:14px;background:var(--secondary,#fff);box-shadow:0 18px 70px rgba(0,0,0,.25);outline:none}
      #${UI_ID} .ldd-head{display:flex;align-items:center;gap:10px;padding:18px 20px 15px;border-bottom:1px solid rgba(100,120,140,.18)}
      #${UI_ID} .ldd-head svg{width:25px;height:25px;color:#648bb2}
      #${UI_ID} .ldd-head strong{font-size:20px;letter-spacing:-.3px}
      #${UI_ID} .ldd-head small{display:block;margin-top:2px;color:#7d8995;font-size:11px;font-weight:400}
      #${UI_ID} .ldd-head-actions{margin-left:auto;display:flex;align-items:center;gap:10px}
      #${UI_ID} .ldd-head-toggle{display:flex;align-items:center;gap:7px;color:#6f7c88;font-size:11px;font-weight:600}
      #${UI_ID} .ldd-close{width:32px;height:32px;border:0;border-radius:8px;background:transparent;color:#74808c;font-size:22px;cursor:pointer}
      #${UI_ID} .ldd-close:hover{background:rgba(100,120,140,.12)}
      #${UI_ID} .ldd-body{padding:17px 20px 20px}
      #${UI_ID} .ldd-body>.ldd-section:first-child{margin-top:0}
      #${UI_ID} .ldd-switch{position:relative;width:42px;height:24px;border:0;border-radius:99px;background:#b8c0c8;cursor:pointer}
      #${UI_ID} .ldd-switch::after{content:"";position:absolute;top:3px;left:3px;width:18px;height:18px;border-radius:50%;background:#fff;box-shadow:0 1px 4px rgba(0,0,0,.25);transition:transform .16s ease}
      #${UI_ID} .ldd-switch.is-on{background:#648bb2}#${UI_ID} .ldd-switch.is-on::after{transform:translateX(18px)}
      #${UI_ID} .ldd-section{margin-top:18px}
      #${UI_ID} .ldd-section h3{margin:0 0 8px;font-size:14px}
      #${UI_ID} .ldd-section p{margin:0 0 9px;color:#7a8793;font-size:11px;line-height:1.55}
      #${UI_ID} .ldd-radios{display:grid;grid-template-columns:1fr 1fr;gap:9px}
      #${UI_ID} .ldd-radio{display:flex;align-items:flex-start;gap:8px;padding:11px;border:1px solid rgba(100,120,140,.24);border-radius:9px;cursor:pointer}
      #${UI_ID} .ldd-radio:has(input:checked){border-color:#648bb2;background:rgba(100,139,178,.08)}
      #${UI_ID} .ldd-radio input{margin-top:2px}#${UI_ID} .ldd-radio b{display:block;font-size:13px}#${UI_ID} .ldd-radio small{display:block;margin-top:3px;color:#7b8792;font-size:10px;line-height:1.45}
      #${UI_ID} .ldd-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}
      #${UI_ID} textarea{box-sizing:border-box;width:100%;min-height:112px;resize:vertical;padding:10px 11px;border:1px solid rgba(100,120,140,.28);border-radius:9px;background:var(--secondary,#fff);color:inherit;font:12px/1.55 ui-monospace,SFMono-Regular,Consolas,monospace;outline:none}
      #${UI_ID} textarea:focus{border-color:#648bb2;box-shadow:0 0 0 3px rgba(100,139,178,.12)}
      #${UI_ID} .ldd-options{display:grid;grid-template-columns:1fr 1fr;gap:8px 14px}
      #${UI_ID} .ldd-clean-column .ldd-options{grid-template-columns:1fr}
      #${UI_ID} .ldd-check{display:flex;align-items:center;gap:7px;font-size:12px;cursor:pointer}
      #${UI_ID} .ldd-option-note{display:block;margin:4px 0 0 22px;color:#7a8793;font-size:10px;line-height:1.45}
      #${UI_ID} .ldd-actions{display:flex;align-items:center;gap:8px;margin-top:20px;padding-top:15px;border-top:1px solid rgba(100,120,140,.18)}
      #${UI_ID} .ldd-actions button{min-height:34px;padding:7px 13px;border:0;border-radius:8px;font-size:12px;cursor:pointer}
      #${UI_ID} .ldd-save{background:#648bb2;color:#fff;font-weight:600}#${UI_ID} .ldd-reset{background:rgba(100,120,140,.12);color:inherit}#${UI_ID} .ldd-cancel{margin-left:auto;background:transparent;color:#6e7a86}
      #${UI_ID} .ldd-status{margin-top:9px;min-height:16px;color:#65806d;font-size:11px}
      #${TOAST_ID}{position:fixed;z-index:100001;left:50%;bottom:28px;transform:translate(-50%,12px);padding:9px 13px;border-radius:8px;background:#26384a;color:#fff;font:12px/1.3 Arial,"PingFang SC","Microsoft YaHei",sans-serif;box-shadow:0 7px 24px rgba(0,0,0,.25);opacity:0;pointer-events:none;transition:opacity .18s ease,transform .18s ease}
      #${TOAST_ID}.is-visible{opacity:1;transform:translate(-50%,0)}
      @media(max-width:620px){#${UI_ID} .ldd-grid,#${UI_ID} .ldd-radios,#${UI_ID} .ldd-options{grid-template-columns:1fr}#${UI_ID} .ldd-dialog{max-height:calc(100vh - 20px)}#${UI_ID}{padding:10px}}
      @media(prefers-reduced-motion:reduce){#${UI_ID} .ldd-switch::after,#${TOAST_ID}{transition:none}}
    `;
    (document.head || document.documentElement).appendChild(style);
  }

  function injectUi() {
    if (!document.body || document.getElementById(UI_ID)) return;
    const ui = document.createElement('div');
    ui.id = UI_ID;
    ui.innerHTML = `
      <div class="ldd-backdrop" data-ldd-close></div>
      <section class="ldd-dialog" role="dialog" aria-modal="true" aria-labelledby="ldd-title" tabindex="-1">
        <header class="ldd-head">
          ${iconSvg()}
          <div><strong id="ldd-title">溶解计划</strong><small>比拉黑更柔和的本地身份黑名单</small></div>
          <div class="ldd-head-actions">
            <div class="ldd-head-toggle"><span>溶解</span><button type="button" class="ldd-switch" data-ldd-enabled role="switch" aria-label="启用或停用溶解" title="启用或停用溶解"></button></div>
            <button class="ldd-close" type="button" aria-label="关闭" data-ldd-close>×</button>
          </div>
        </header>
        <main class="ldd-body">
          <section class="ldd-section">
            <h3>随机身份重置方式</h3>
            <div class="ldd-radios">
              <label class="ldd-radio"><input type="radio" name="ldd-mode" value="time"><span><b>时间模式</b><small>10 小时未触发即重置；单轮身份最长保留 24 小时。</small></span></label>
              <label class="ldd-radio"><input type="radio" name="ldd-mode" value="topic"><span><b>帖子模式</b><small>同一帖子内身份稳定，进入不同帖子重新生成。</small></span></label>
            </div>
          </section>

          <section class="ldd-section">
            <h3>溶解用户</h3>
            <p>填写真实用户名，一行一个。可见名字会替换为 5–9 个字母的随机英文单词。</p>
            <textarea data-ldd-dissolved spellcheck="false" placeholder="username"></textarea>
          </section>

          <section class="ldd-section ldd-grid">
            <div class="ldd-clean-column">
              <h3>基础清洗</h3>
              <p>处理身份、头像、装饰、签名和发帖时的假名映射。</p>
              <div class="ldd-options">
                <label class="ldd-check"><input type="checkbox" data-ldd-option="replaceAvatars">替换头像</label>
                <label class="ldd-check"><input type="checkbox" data-ldd-option="hideIdentityDecorations">清除头像框、标签和勋章</label>
                <label class="ldd-check"><input type="checkbox" data-ldd-option="hideSignatures">隐藏签名档</label>
                <label class="ldd-check"><input type="checkbox" data-ldd-option="mapAliasMentions">发送时自动映射 @随机名</label>
              </div>
            </div>
            <div class="ldd-clean-column">
              <h3>深度清洗</h3>
              <p>进一步处理被溶解用户发布的主题及帖子标题。</p>
              <div class="ldd-options">
                <label class="ldd-check"><input type="checkbox" data-ldd-option="hideDissolvedTopics">隐藏其发布的帖子</label>
                <label class="ldd-check"><input type="checkbox" data-ldd-option="cleanTopicTitles">清洗帖子标题的括号和 Emoji</label>
                <div>
                  <label class="ldd-check"><input type="checkbox" data-ldd-option="pureMode">纯净模式</label>
                  <small class="ldd-option-note">类似匿名版：溶解所有人并清洗所有标题。</small>
                </div>
              </div>
            </div>
          </section>

          <div class="ldd-actions">
            <button type="button" class="ldd-save" data-ldd-save>保存并应用</button>
            <button type="button" class="ldd-reset" data-ldd-reset>立即重置随机身份</button>
            <button type="button" class="ldd-cancel" data-ldd-close>关闭</button>
          </div>
          <div class="ldd-status" data-ldd-status></div>
        </main>
      </section>
    `;

    ui.addEventListener('click', event => {
      if (event.target.closest('[data-ldd-close]')) closeUi();
      if (event.target.closest('[data-ldd-save]')) saveUi();
      if (event.target.closest('[data-ldd-reset]')) {
        resetCurrentIdentities('用户手动重置');
        showUiStatus('随机身份已重置。');
      }
      if (event.target.closest('[data-ldd-enabled]')) {
        saveUi({ toggleEnabled: true, statusMessage: '' });
      }
    });

    ui.addEventListener('keydown', event => {
      if (event.key === 'Escape') closeUi();
    });

    document.body.appendChild(ui);
  }

  function openUi() {
    injectUi();
    renderUi();
    const ui = document.getElementById(UI_ID);
    if (!ui) return;
    ui.classList.add('is-open');
    setTimeout(() => ui.querySelector('.ldd-dialog')?.focus(), 0);
  }

  function closeUi() {
    document.getElementById(UI_ID)?.classList.remove('is-open');
  }

  function renderUi() {
    updateHeaderButtonState();
    const ui = document.getElementById(UI_ID);
    if (!ui) return;
    const config = runtime.state.config;
    const enabled = ui.querySelector('[data-ldd-enabled]');
    enabled.classList.toggle('is-on', config.enabled);
    enabled.setAttribute('aria-checked', String(config.enabled));
    const mode = ui.querySelector('input[name="ldd-mode"][value="' + config.resetMode + '"]');
    if (mode) mode.checked = true;
    ui.querySelector('[data-ldd-dissolved]').value = runtime.state.dissolvedUsers.join('\n');
    ui.querySelectorAll('[data-ldd-option]').forEach(input => {
      input.checked = Boolean(config[input.dataset.lddOption]);
    });
  }

  function readUiDraft(ui) {
    const selectedMode = ui.querySelector('input[name="ldd-mode"]:checked')?.value;
    const config = { ...runtime.state.config };
    config.resetMode = selectedMode === 'topic' ? 'topic' : 'time';
    ui.querySelectorAll('[data-ldd-option]').forEach(input => {
      config[input.dataset.lddOption] = input.checked;
    });
    return {
      config,
      dissolvedUsers: splitUsernames(ui.querySelector('[data-ldd-dissolved]').value)
    };
  }

  function saveUi(options = {}) {
    const ui = document.getElementById(UI_ID);
    if (!ui) return;
    const previousMode = runtime.state.config.resetMode;
    const draft = readUiDraft(ui);
    runtime.state.config = draft.config;
    runtime.state.dissolvedUsers = draft.dissolvedUsers;
    if (options.toggleEnabled) runtime.state.config.enabled = !runtime.state.config.enabled;
    if (previousMode !== runtime.state.config.resetMode && runtime.state.config.resetMode === 'time') {
      const now = Date.now();
      runtime.state.timeEpoch = {
        id: randomToken(16),
        startedAt: now,
        lastTriggeredAt: 0
      };
      runtime.activeTriggerNodes = new WeakSet();
    }
    rebuildSets();
    const changedFields = ['config', 'dissolvedUsers'];
    if (previousMode !== runtime.state.config.resetMode && runtime.state.config.resetMode === 'time') {
      changedFields.push('timeEpoch');
    }
    saveState(changedFields);
    syncActiveMarker();
    restoreAll();
    if (runtime.state.config.enabled) queueScan(document);
    renderUi();
    const message = options.statusMessage === undefined ? '已保存并应用。' : options.statusMessage;
    if (message) showUiStatus(message);
  }

  function showUiStatus(message) {
    const status = document.querySelector('#' + UI_ID + ' [data-ldd-status]');
    if (!status) return;
    status.textContent = message;
    clearTimeout(status.__lddTimer);
    status.__lddTimer = setTimeout(() => { status.textContent = ''; }, 2500);
  }

  function showToast(message) {
    let toast = document.getElementById(TOAST_ID);
    if (!toast) {
      toast = document.createElement('div');
      toast.id = TOAST_ID;
      document.body?.appendChild(toast);
    }
    if (!toast) return;
    toast.textContent = message;
    clearTimeout(toast.__lddTimer);
    requestAnimationFrame(() => toast.classList.add('is-visible'));
    toast.__lddTimer = setTimeout(() => toast.classList.remove('is-visible'), 1800);
  }

  function registerMenuCommands() {
    if (typeof GM_registerMenuCommand !== 'function') return;
    GM_registerMenuCommand('打开溶解计划', openUi);
    GM_registerMenuCommand('立即重置随机身份', () => {
      resetCurrentIdentities('用户手动重置');
      showToast('随机身份已重置。');
    });
  }

  function stateVisualFingerprint(state) {
    return JSON.stringify({
      config: state.config,
      dissolvedUsers: state.dissolvedUsers,
      secret: state.secret,
      topicSalt: state.topicSalt,
      timeEpoch: {
        id: state.timeEpoch.id,
        startedAt: state.timeEpoch.startedAt
      }
    });
  }

  function updateEnabledUiOnly() {
    syncActiveMarker();
    updateHeaderButtonState();
    const ui = document.getElementById(UI_ID);
    const enabled = ui?.querySelector('[data-ldd-enabled]');
    if (!enabled) return;
    enabled.classList.toggle('is-on', runtime.state.config.enabled);
    enabled.setAttribute('aria-checked', String(runtime.state.config.enabled));
  }

  function listenForRemoteStateChanges() {
    if (typeof GM_addValueChangeListener !== 'function') return;
    GM_addValueChangeListener(STORE_KEY, (_, __, value, remote) => {
      if (!remote) return;
      try {
        const nextState = normalizeState(typeof value === 'string' ? JSON.parse(value) : value);
        const visualChanged = stateVisualFingerprint(runtime.state) !== stateVisualFingerprint(nextState);
        runtime.state = nextState;
        runtime.persistedStateSnapshot = JSON.stringify(nextState);
        if (!visualChanged) {
          // 其他标签页仅刷新了 lastTriggeredAt；不恢复 DOM，避免真实身份闪现。
          updateEnabledUiOnly();
          return;
        }
        rebuildSets();
        syncActiveMarker();
        restoreAll();
        if (runtime.state.config.enabled) queueScan(document);
        renderUi();
      } catch (error) {
        console.warn('[DissolvePlan] 跨标签页状态同步失败。', error);
      }
    });
  }

  function init() {
    if (redirectBlockedProfileIfNeeded()) return;
    syncActiveMarker();
    injectStyle();
    hookRouting();
    interceptDissolvedProfileNavigation();
    interceptComposerAliasMentions();
    registerMenuCommands();
    listenForRemoteStateChanges();

    const ready = () => {
      injectUi();
      ensureHeaderButton();
      startObserver();
      queueScan(document);
      try {
        if (sessionStorage.getItem(PROFILE_BLOCK_FLAG)) {
          sessionStorage.removeItem(PROFILE_BLOCK_FLAG);
          setTimeout(() => showToast('无法跳转，此人被溶解'), 0);
        }
      } catch (_) {}
    };

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', ready, { once: true });
    } else {
      ready();
    }
  }

  init();
})();
