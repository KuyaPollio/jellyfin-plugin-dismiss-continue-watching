/**
 * Adds a dismiss button on Continue Watching cards.
 * Clicking it marks the item as played via the native Jellyfin API.
 */

(function () {
  'use strict';

  const LOG = '[DismissContinueWatching]';
  console.log(`${LOG} Initializing...`);

  const style = document.createElement('style');
  style.textContent = `
    .dismiss-continue-watching-button {
      z-index: 12 !important;
    }

    /* Standalone fallback when no native overlay button row exists */
    .dismiss-continue-watching-button.dismiss-continue-watching-fallback {
      position: absolute !important;
      top: 6px !important;
      right: 6px !important;
      background: rgba(0, 0, 0, 0.75) !important;
      border: none !important;
      border-radius: 50% !important;
      width: 36px !important;
      height: 36px !important;
      display: flex !important;
      align-items: center !important;
      justify-content: center !important;
      cursor: pointer !important;
      opacity: 0 !important;
      pointer-events: none !important;
      transition: opacity 0.15s ease, transform 0.15s ease !important;
      transform: scale(0.9) !important;
    }

    .card:hover .dismiss-continue-watching-button.dismiss-continue-watching-fallback,
    .card:focus-within .dismiss-continue-watching-button.dismiss-continue-watching-fallback,
    .dismiss-continue-watching-button.dismiss-continue-watching-fallback:focus {
      opacity: 1 !important;
      pointer-events: auto !important;
      transform: scale(1) !important;
    }

    /* Touch / coarse pointers: always show on resume cards */
    @media (hover: none), (pointer: coarse) {
      .dismiss-continue-watching-button.dismiss-continue-watching-fallback {
        opacity: 1 !important;
        pointer-events: auto !important;
        transform: scale(1) !important;
      }
    }

    .dismiss-continue-watching-button.dismiss-continue-watching-fallback:hover {
      background: rgba(220, 38, 38, 0.95) !important;
    }

    .dismiss-continue-watching-button .material-icons,
    .dismiss-continue-watching-button .cardOverlayButtonIcon {
      pointer-events: none;
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

  function getResumeCard(fromEl) {
    const card = fromEl.closest ? fromEl.closest('.card') : null;
    if (!card) {
      return null;
    }

    // Continue Watching / resume items expose data-positionticks (truthy ticks only)
    const ticks = card.getAttribute('data-positionticks');
    if (!ticks || ticks === '0') {
      return null;
    }

    return card;
  }

  function createDismissButton(itemId, { fallback }) {
    const dismissButton = document.createElement('button');
    dismissButton.type = 'button';
    dismissButton.setAttribute('data-action', 'none');
    dismissButton.setAttribute('data-id', itemId);
    dismissButton.title = 'Mark as watched (remove from Continue Watching)';
    dismissButton.setAttribute('aria-label', 'Mark as watched');

    if (fallback) {
      dismissButton.className = 'dismiss-continue-watching-button dismiss-continue-watching-fallback';
    } else {
      // Match native hover-menu buttons so it appears with check / favorite / more
      dismissButton.className =
        'cardOverlayButton cardOverlayButton-hover itemAction paper-icon-button-light dismiss-continue-watching-button';
      dismissButton.setAttribute('is', 'paper-icon-button-light');
    }

    const icon = document.createElement('span');
    icon.className = fallback
      ? 'material-icons'
      : 'material-icons cardOverlayButtonIcon cardOverlayButtonIcon-hover';
    icon.textContent = 'close';
    icon.setAttribute('aria-hidden', 'true');
    dismissButton.appendChild(icon);

    dismissButton.addEventListener('click', async e => {
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();

      const card = dismissButton.closest('.card');
      const originalIcon = icon.textContent;
      icon.textContent = 'hourglass_empty';
      dismissButton.disabled = true;

      try {
        await markItemPlayed(itemId);
        if (card) {
          card.remove();
        }
        console.log(`${LOG} Marked item ${itemId} as played`);
      } catch (error) {
        console.error(`${LOG} Failed to mark as played:`, error);
        icon.textContent = originalIcon;
        dismissButton.disabled = false;
        alert('Failed to remove from Continue Watching. Please try again.');
      }
    });

    return dismissButton;
  }

  /**
   * Inject dismiss control into a resume card.
   * @param {Element} card
   */
  function addDismissButtonToCard(card) {
    if (!card || card.querySelector('.dismiss-continue-watching-button')) {
      return;
    }

    const ticks = card.getAttribute('data-positionticks');
    if (!ticks || ticks === '0') {
      return;
    }

    const itemId = card.getAttribute('data-id');
    if (!itemId) {
      return;
    }

    // Desktop hover menu + mobile overlay share .cardOverlayButton-br
    const buttonRow = card.querySelector('.cardOverlayButton-br');
    if (buttonRow) {
      const btn = createDismissButton(itemId, { fallback: false });
      buttonRow.insertBefore(btn, buttonRow.firstChild);
      console.log(`${LOG} Added native-style button for ${itemId}`);
      return;
    }

    // Fallback: absolute button on the scalable image area
    const host =
      card.querySelector('.cardScalable') ||
      card.querySelector('.cardBox') ||
      card;
    if (getComputedStyle(host).position === 'static') {
      host.style.position = 'relative';
    }

    host.appendChild(createDismissButton(itemId, { fallback: true }));
    console.log(`${LOG} Added fallback button for ${itemId}`);
  }

  function processResumeCards(root) {
    const scope = root && root.querySelectorAll ? root : document;
    const cards = [];

    if (scope.classList && scope.classList.contains('card')) {
      cards.push(scope);
    }

    scope.querySelectorAll?.('.card[data-positionticks]').forEach(card => cards.push(card));

    cards.forEach(addDismissButtonToCard);

    // Overlays may appear as separate nodes; map them back to resume cards
    scope.querySelectorAll?.('.cardOverlayContainer').forEach(overlay => {
      const card = getResumeCard(overlay);
      if (card) {
        addDismissButtonToCard(card);
      }
    });
  }

  function setupObserver() {
    const observer = new MutationObserver(mutations => {
      for (const mutation of mutations) {
        if (mutation.type !== 'childList') {
          continue;
        }

        mutation.addedNodes.forEach(node => {
          if (node.nodeType !== Node.ELEMENT_NODE) {
            return;
          }
          processResumeCards(node);
        });
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });

    processResumeCards(document);
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
      // Home sections often hydrate after first paint
      setTimeout(() => processResumeCards(document), 1500);
      setTimeout(() => processResumeCards(document), 4000);
      console.log(`${LOG} Ready`);
    } catch (error) {
      console.error(`${LOG} Initialization aborted:`, error);
    }
  }

  init();
})();
