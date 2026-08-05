/**
 * Adds a dismiss button on Continue Watching / resume cards.
 * Clicking it marks the item as played via the native Jellyfin API.
 */

(function () {
  'use strict';

  const LOG = '[DismissContinueWatching]';
  const BTN_CLASS = 'dismiss-continue-watching-button';
  console.log(`${LOG} Initializing...`);

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

    /* Ensure positioning context on common card hosts */
    .card.dismiss-cw-host .cardScalable,
    .card.dismiss-cw-host .cardBox,
    .card.dismiss-cw-host {
      position: relative;
    }
  `;
  document.head.appendChild(style);

  function markItemPlayed(itemId) {
    if (!window.ApiClient || !window.ApiClient.accessToken || !window.ApiClient.accessToken()) {
      return Promise.reject(new Error('ApiClient not available'));
    }

    const userId = window.ApiClient.getCurrentUserId();
    if (!userId) {
      return Promise.reject(new Error('No current user'));
    }

    if (typeof window.ApiClient.markPlayed === 'function') {
      return window.ApiClient.markPlayed(userId, itemId);
    }

    const url = window.ApiClient.getUrl(`Users/${userId}/PlayedItems/${itemId}`);
    return fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `MediaBrowser Token="${window.ApiClient.accessToken()}"`,
      },
    }).then(response => {
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
    });
  }

  function getItemId(card) {
    return (
      card.getAttribute('data-id') ||
      card.querySelector('[data-id]')?.getAttribute('data-id') ||
      null
    );
  }

  function hasResumeProgress(card) {
    if (!card || !card.getAttribute) {
      return false;
    }

    const ticks =
      card.getAttribute('data-positionticks') ||
      card.querySelector('[data-positionticks]')?.getAttribute('data-positionticks');

    if (ticks && ticks !== '0') {
      return true;
    }

    // Resume cards almost always render a progress bar
    if (card.querySelector('.itemProgressBar, .cardProgressBar, emby-progressbar, [is="emby-progressbar"]')) {
      return true;
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
    btn.title = 'Mark as watched (remove from Continue Watching)';
    btn.setAttribute('aria-label', 'Mark as watched');

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
          await markItemPlayed(itemId);
          card?.remove();
          console.log(`${LOG} Marked item ${itemId} as played`);
        } catch (error) {
          console.error(`${LOG} Failed to mark as played:`, error);
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

    if (!hasResumeProgress(card)) {
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

  function collectResumeCards(root) {
    const scope = root && root.nodeType === Node.ELEMENT_NODE ? root : document;
    const found = new Set();

    const maybeAdd = el => {
      const card = el.classList?.contains('card') ? el : el.closest?.('.card');
      if (card && hasResumeProgress(card)) {
        found.add(card);
      }
    };

    if (scope.classList?.contains('card')) {
      maybeAdd(scope);
    }

    scope.querySelectorAll?.('.card[data-positionticks]').forEach(maybeAdd);
    scope.querySelectorAll?.('.card .itemProgressBar, .card .cardProgressBar').forEach(el => maybeAdd(el));
    scope.querySelectorAll?.('.card [data-positionticks]').forEach(el => maybeAdd(el));

    return [...found];
  }

  function processResumeCards(root, reason) {
    const cards = collectResumeCards(root);
    let added = 0;
    cards.forEach(card => {
      if (addDismissButtonToCard(card)) {
        added++;
      }
    });

    if (added > 0 || reason === 'debug') {
      console.log(`${LOG} scan(${reason || 'mutation'}): ${cards.length} resume card(s), added ${added}`);
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

      // Some Jellyfin themes rewrite large home sections in one pass
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
        if (window.ApiClient && window.ApiClient.accessToken && window.ApiClient.accessToken()) {
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

      // Home sections hydrate asynchronously
      [500, 1500, 3000, 6000, 10000].forEach(ms => {
        setTimeout(() => processResumeCards(document, `t+${ms}`), ms);
      });

      // Expose manual debug helper in the browser console
      window.DismissContinueWatching = {
        rescan: () => processResumeCards(document, 'debug'),
        debug() {
          const allCards = document.querySelectorAll('.card');
          const withTicks = document.querySelectorAll('.card[data-positionticks], .card [data-positionticks]');
          const withBar = document.querySelectorAll('.card .itemProgressBar, .card .cardProgressBar');
          const buttons = document.querySelectorAll(`.${BTN_CLASS}`);
          const sample = [...document.querySelectorAll('.card')].slice(0, 5).map(c => ({
            id: c.getAttribute('data-id'),
            ticks: c.getAttribute('data-positionticks'),
            classes: c.className,
            hasBar: !!c.querySelector('.itemProgressBar, .cardProgressBar'),
          }));
          const result = {
            allCards: allCards.length,
            withTicks: withTicks.length,
            withBar: withBar.length,
            buttons: buttons.length,
            sample,
          };
          console.log(`${LOG} debug`, result);
          processResumeCards(document, 'debug');
          return result;
        },
      };

      console.log(`${LOG} Ready — run DismissContinueWatching.debug() if the button is missing`);
    } catch (error) {
      console.error(`${LOG} Initialization aborted:`, error);
    }
  }

  init();
})();
