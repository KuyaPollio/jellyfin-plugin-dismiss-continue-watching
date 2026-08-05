/**
 * Dismiss Continue Watching cards and keep them hidden via a server denylist.
 */

(function () {
  'use strict';

  const VERSION = '1.0.5';
  const LOG = '[DismissContinueWatching]';
  const BTN_CLASS = 'dismiss-continue-watching-button';

  window.DismissContinueWatching = {
    version: VERSION,
    ready: false,
  };
  console.log(`${LOG} Initializing v${VERSION}...`);

  const style = document.createElement('style');
  style.textContent = `
    .${BTN_CLASS} {
      position: absolute !important;
      top: 6px !important;
      right: 6px !important;
      z-index: 30 !important;
      width: 34px !important;
      height: 34px !important;
      padding: 0 !important;
      margin: 0 !important;
      border: none !important;
      border-radius: 50% !important;
      background: rgba(0, 0, 0, 0.72) !important;
      color: #fff !important;
      display: flex !important;
      align-items: center !important;
      justify-content: center !important;
      cursor: pointer !important;
      opacity: 1 !important;
      pointer-events: auto !important;
      box-shadow: 0 1px 4px rgba(0, 0, 0, 0.45) !important;
    }

    .${BTN_CLASS}:hover,
    .${BTN_CLASS}:focus {
      background: rgba(198, 40, 40, 0.95) !important;
      transform: scale(1.06);
    }

    .${BTN_CLASS}:disabled {
      opacity: 0.55 !important;
      cursor: wait !important;
    }

    .${BTN_CLASS} .material-icons {
      color: #fff !important;
      font-size: 18px !important;
      line-height: 1 !important;
      pointer-events: none !important;
    }

    .card.dismiss-cw-host .cardScalable,
    .card.dismiss-cw-host .cardBox,
    .card.dismiss-cw-host {
      position: relative;
    }
  `;
  document.head.appendChild(style);

  let denylist = new Set();

  function normalizeId(id) {
    return String(id || '')
      .replace(/-/g, '')
      .toLowerCase();
  }

  function getApiClient() {
    if (!window.ApiClient || !window.ApiClient.accessToken || !window.ApiClient.accessToken()) {
      return null;
    }
    return window.ApiClient;
  }

  function authHeaders(extra) {
    const api = getApiClient();
    return {
      Authorization: `MediaBrowser Token="${api.accessToken()}"`,
      ...(extra || {}),
    };
  }

  async function loadDenylist() {
    const api = getApiClient();
    if (!api) {
      denylist = new Set();
      return;
    }

    const url = api.getUrl('DismissContinueWatching/Items');
    const res = await fetch(url, { headers: authHeaders() });
    if (!res.ok) {
      throw new Error(`Failed to load denylist: HTTP ${res.status}`);
    }

    const items = await res.json();
    denylist = new Set((items || []).map(normalizeId));
    console.log(`${LOG} Loaded denylist (${denylist.size})`);
  }

  async function addToDenylist(itemId) {
    const api = getApiClient();
    if (!api) {
      throw new Error('ApiClient not available');
    }

    const url = api.getUrl(`DismissContinueWatching/Items/${itemId}`);
    const res = await fetch(url, {
      method: 'POST',
      headers: authHeaders({ 'Content-Type': 'application/json' }),
    });
    if (!res.ok) {
      throw new Error(`Failed to dismiss: HTTP ${res.status}`);
    }

    denylist.add(normalizeId(itemId));
  }

  async function markPlayed(itemId) {
    const api = getApiClient();
    if (!api) {
      return;
    }

    const userId = api.getCurrentUserId();
    if (!userId) {
      return;
    }

    try {
      if (typeof api.markPlayed === 'function') {
        await api.markPlayed(userId, itemId, new Date());
      } else {
        const url = api.getUrl(`Users/${userId}/PlayedItems/${itemId}`);
        await fetch(url, { method: 'POST', headers: authHeaders() });
      }
    } catch (error) {
      // Denylist is the source of truth for hiding; markPlayed is best-effort.
      console.warn(`${LOG} markPlayed failed (ignored):`, error);
    }
  }

  function getItemId(card) {
    return (
      card.getAttribute('data-id') ||
      card.querySelector(':scope > .cardBox [data-id], :scope > [data-id]')?.getAttribute('data-id') ||
      null
    );
  }

  function isResumeSignalCard(card) {
    if (!card?.getAttribute) {
      return false;
    }

    const ticks =
      card.getAttribute('data-positionticks') ||
      card.querySelector('[data-positionticks]')?.getAttribute('data-positionticks');
    if (ticks && ticks !== '0') {
      return true;
    }

    if (card.querySelector('.itemProgressBar, .cardProgressBar, [is="emby-progressbar"]')) {
      return true;
    }

    if (card.querySelector('[data-action="resume"]')) {
      return true;
    }

    return false;
  }

  function isDismissTargetCard(card) {
    if (!card?.classList?.contains('card')) {
      return false;
    }

    const type = (card.getAttribute('data-type') || '').toLowerCase();
    if (type === 'collectionfolder' || type === 'userview') {
      return false;
    }

    if (isResumeSignalCard(card)) {
      return true;
    }

    const container =
      card.closest('.itemsContainer, emby-itemscontainer, [is="emby-itemscontainer"], .scrollSlider') ||
      card.parentElement;
    if (!container) {
      return false;
    }

    for (const sibling of container.querySelectorAll('.card')) {
      if (sibling !== card && isResumeSignalCard(sibling)) {
        return true;
      }
    }

    return false;
  }

  function filterDenylistedCards(root) {
    const scope = root && root.nodeType === Node.ELEMENT_NODE ? root : document;
    const cards = [];
    if (scope.classList?.contains('card')) {
      cards.push(scope);
    }
    scope.querySelectorAll?.('.card[data-id]').forEach(card => cards.push(card));

    let removed = 0;
    cards.forEach(card => {
      const id = normalizeId(getItemId(card));
      if (id && denylist.has(id)) {
        card.remove();
        removed++;
      }
    });
    return removed;
  }

  function getButtonHost(card) {
    return (
      card.querySelector('.cardScalable') ||
      card.querySelector('.cardImageContainer') ||
      card.querySelector('.cardBox') ||
      card
    );
  }

  function createDismissButton(itemId) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = BTN_CLASS;
    btn.setAttribute('data-action', 'none');
    btn.setAttribute('data-dismiss-cw', 'true');
    btn.setAttribute('data-id', itemId);
    btn.title = 'Remove from Continue Watching';
    btn.setAttribute('aria-label', 'Remove from Continue Watching');

    const icon = document.createElement('span');
    icon.className = 'material-icons';
    icon.textContent = 'close';
    icon.setAttribute('aria-hidden', 'true');
    btn.appendChild(icon);

    btn.addEventListener(
      'click',
      async e => {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();

        const card = btn.closest('.card');
        const originalIcon = icon.textContent;
        icon.textContent = 'hourglass_empty';
        btn.disabled = true;

        try {
          await addToDenylist(itemId);
          await markPlayed(itemId);
          card?.remove();
          console.log(`${LOG} Dismissed item ${itemId}`);
        } catch (error) {
          console.error(`${LOG} Failed to dismiss:`, error);
          icon.textContent = originalIcon;
          btn.disabled = false;
          alert('Failed to remove from Continue Watching. Please try again.');
        }
      },
      true
    );

    return btn;
  }

  function addDismissButtonToCard(card) {
    if (!card || card.querySelector(`.${BTN_CLASS}`)) {
      return false;
    }

    if (!isDismissTargetCard(card)) {
      return false;
    }

    const itemId = getItemId(card);
    if (!itemId) {
      return false;
    }

    if (denylist.has(normalizeId(itemId))) {
      card.remove();
      return false;
    }

    card.classList.add('dismiss-cw-host');
    const host = getButtonHost(card);
    if (getComputedStyle(host).position === 'static') {
      host.style.position = 'relative';
    }

    host.appendChild(createDismissButton(itemId));
    return true;
  }

  function collectTargetCards(root) {
    const scope = root && root.nodeType === Node.ELEMENT_NODE ? root : document;
    const found = new Set();

    const consider = el => {
      const card = el.classList?.contains('card') ? el : el.closest?.('.card');
      if (card && isDismissTargetCard(card)) {
        found.add(card);
      }
    };

    if (scope.classList?.contains('card')) {
      consider(scope);
    }

    scope.querySelectorAll?.('.card[data-positionticks]').forEach(consider);
    scope.querySelectorAll?.('.card .itemProgressBar, .card .cardProgressBar').forEach(el => consider(el));
    scope.querySelectorAll?.('.card [data-action="resume"]').forEach(el => consider(el));

    [...found].forEach(card => {
      const container =
        card.closest('.itemsContainer, emby-itemscontainer, [is="emby-itemscontainer"], .scrollSlider') ||
        card.parentElement;
      container?.querySelectorAll?.('.card').forEach(sibling => {
        if (isDismissTargetCard(sibling)) {
          found.add(sibling);
        }
      });
    });

    return [...found];
  }

  function processResumeCards(root, reason) {
    filterDenylistedCards(root);

    const cards = collectTargetCards(root);
    let added = 0;
    cards.forEach(card => {
      if (addDismissButtonToCard(card)) {
        added++;
      }
    });

    if (added > 0 || reason === 'debug') {
      console.log(
        `${LOG} scan(${reason || 'mutation'}): ${cards.length} target(s), added ${added}, denylist ${denylist.size}`
      );
    }

    return { cards: cards.length, added, denylist: denylist.size };
  }

  function setupObserver() {
    const observer = new MutationObserver(mutations => {
      let shouldScan = false;
      for (const mutation of mutations) {
        if (mutation.type !== 'childList' || mutation.addedNodes.length === 0) {
          continue;
        }
        shouldScan = true;
        mutation.addedNodes.forEach(node => {
          if (node.nodeType === Node.ELEMENT_NODE) {
            processResumeCards(node, 'added');
          }
        });
      }

      if (shouldScan) {
        processResumeCards(document, 'document');
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });

    processResumeCards(document, 'init');
  }

  function waitForApiClient() {
    return new Promise((resolve, reject) => {
      let retryCount = 0;
      const maxRetries = 30;

      const checkApiClient = () => {
        if (getApiClient()) {
          resolve();
          return;
        }

        retryCount++;
        if (retryCount >= maxRetries) {
          reject(new Error('ApiClient not available'));
          return;
        }

        setTimeout(checkApiClient, 1000);
      };

      checkApiClient();
    });
  }

  async function init() {
    try {
      await waitForApiClient();
      await loadDenylist();
      setupObserver();

      [500, 1500, 3000, 6000, 10000].forEach(ms => {
        setTimeout(() => processResumeCards(document, `t+${ms}`), ms);
      });

      window.DismissContinueWatching = {
        version: VERSION,
        ready: true,
        denylist: () => [...denylist],
        rescan: () => processResumeCards(document, 'debug'),
        async reloadDenylist() {
          await loadDenylist();
          return processResumeCards(document, 'debug');
        },
        debug() {
          const result = {
            version: VERSION,
            denylist: [...denylist],
            buttons: document.querySelectorAll(`.${BTN_CLASS}`).length,
            targets: collectTargetCards(document).length,
          };
          console.log(`${LOG} debug`, result);
          processResumeCards(document, 'debug');
          return result;
        },
      };

      console.log(`${LOG} Ready v${VERSION}`);
    } catch (error) {
      console.error(`${LOG} Initialization aborted:`, error);
    }
  }

  init();
})();
