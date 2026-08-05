/**
 * Adds a dismiss button on Continue Watching / resume-row cards.
 * Clicking marks the item watched and clears resume position so it leaves the row.
 */

(function () {
  'use strict';

  const VERSION = '1.0.4';
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

  function getApiClient() {
    if (!window.ApiClient || !window.ApiClient.accessToken || !window.ApiClient.accessToken()) {
      return null;
    }
    return window.ApiClient;
  }

  /**
   * Force-remove from Continue Watching:
   * clear resume ticks + mark played (covers in-progress and already-played oddities).
   */
  async function dismissItem(itemId) {
    const api = getApiClient();
    if (!api) {
      throw new Error('ApiClient not available');
    }

    const userId = api.getCurrentUserId();
    if (!userId) {
      throw new Error('No current user');
    }

    const auth = { Authorization: `MediaBrowser Token="${api.accessToken()}"` };

    // Clear resume point (works even when the card has no data-positionticks)
    const userDataUrl = api.getUrl(`Users/${userId}/Items/${itemId}/UserData`);
    const userDataRes = await fetch(userDataUrl, {
      method: 'POST',
      headers: {
        ...auth,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        PlaybackPositionTicks: 0,
        Played: true,
      }),
    });
    if (!userDataRes.ok) {
      // Fallback for older servers
      if (typeof api.markPlayed === 'function') {
        await api.markPlayed(userId, itemId);
        return;
      }

      const playedUrl = api.getUrl(`Users/${userId}/PlayedItems/${itemId}`);
      const playedRes = await fetch(playedUrl, { method: 'POST', headers: auth });
      if (!playedRes.ok) {
        throw new Error(`HTTP ${userDataRes.status}/${playedRes.status}`);
      }
    }
  }

  function getItemId(card) {
    return (
      card.getAttribute('data-id') ||
      card.querySelector(':scope > .cardBox [data-id], :scope > [data-id]')?.getAttribute('data-id') ||
      null
    );
  }

  /** Strong signal: this card itself is an in-progress / resume item */
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

    // Jellyfin resume/CW cards expose a primary overlay action="resume"
    if (card.querySelector('[data-action="resume"]')) {
      return true;
    }

    return false;
  }

  /**
   * Cards that should get the dismiss button:
   * - any resume-signal card
   * - every sibling card in the same items container as a resume-signal card
   *   (so the whole Continue Watching row is covered, including already-played oddities)
   */
  function isDismissTargetCard(card) {
    if (!card?.classList?.contains('card')) {
      return false;
    }

    // Skip library folders / non-playable tiles
    const type = (card.getAttribute('data-type') || '').toLowerCase();
    if (type === 'collectionfolder' || type === 'userView'.toLowerCase() || type === 'userview') {
      return false;
    }
    if (card.getAttribute('data-isfolder') === 'true' && type !== 'episode' && type !== 'movie') {
      // Series/folder tiles in other rows
      if (!isResumeSignalCard(card)) {
        return false;
      }
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

    // Only promote siblings when this row clearly contains resume/CW cards
    const siblingCards = container.querySelectorAll(':scope > .card, :scope .card');
    for (const sibling of siblingCards) {
      if (sibling !== card && isResumeSignalCard(sibling)) {
        return true;
      }
    }

    return false;
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
          await dismissItem(itemId);
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

    // Expand to full resume rows
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
    const cards = collectTargetCards(root);
    let added = 0;
    cards.forEach(card => {
      if (addDismissButtonToCard(card)) {
        added++;
      }
    });

    if (added > 0 || reason === 'debug') {
      console.log(`${LOG} scan(${reason || 'mutation'}): ${cards.length} target card(s), added ${added}`);
    }

    return { cards: cards.length, added };
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
      setupObserver();

      [500, 1500, 3000, 6000, 10000].forEach(ms => {
        setTimeout(() => processResumeCards(document, `t+${ms}`), ms);
      });

      window.DismissContinueWatching = {
        version: VERSION,
        ready: true,
        rescan: () => processResumeCards(document, 'debug'),
        debug() {
          const allCards = [...document.querySelectorAll('.card')];
          const result = {
            version: VERSION,
            allCards: allCards.length,
            withTicks: document.querySelectorAll('.card[data-positionticks]').length,
            withResumeAction: document.querySelectorAll('.card [data-action="resume"]').length,
            withBar: document.querySelectorAll('.card .itemProgressBar').length,
            buttons: document.querySelectorAll(`.${BTN_CLASS}`).length,
            targets: collectTargetCards(document).length,
            sample: allCards.slice(0, 8).map(c => ({
              id: c.getAttribute('data-id'),
              type: c.getAttribute('data-type'),
              ticks: c.getAttribute('data-positionticks'),
              resume: !!c.querySelector('[data-action="resume"]'),
              hasBar: !!c.querySelector('.itemProgressBar'),
              target: isDismissTargetCard(c),
              hasBtn: !!c.querySelector(`.${BTN_CLASS}`),
            })),
          };
          console.log(`${LOG} debug`, result);
          processResumeCards(document, 'debug');
          return result;
        },
      };

      console.log(`${LOG} Ready v${VERSION} — run window.DismissContinueWatching.debug() if needed`);
    } catch (error) {
      console.error(`${LOG} Initialization aborted:`, error);
    }
  }

  init();
})();
