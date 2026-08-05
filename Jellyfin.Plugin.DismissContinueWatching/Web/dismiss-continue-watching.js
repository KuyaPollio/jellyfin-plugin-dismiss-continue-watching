/**
 * Adds a dismiss button on Continue Watching cards.
 * Clicking it marks the item as played via the native Jellyfin API.
 */

(function () {
  'use strict';

  console.log('[DismissContinueWatching] Initializing...');

  const style = document.createElement('style');
  style.textContent = `
    .dismiss-continue-watching-button {
      position: absolute !important;
      top: 8px !important;
      right: 8px !important;
      z-index: 10 !important;
      background: rgba(0, 0, 0, 0.7) !important;
      border: none !important;
      border-radius: 50% !important;
      width: 32px !important;
      height: 32px !important;
      display: flex !important;
      align-items: center !important;
      justify-content: center !important;
      cursor: pointer !important;
      transition: all 0.2s ease !important;
      opacity: 0 !important;
      transform: scale(0.8) !important;
    }

    .cardOverlayContainer:hover .dismiss-continue-watching-button {
      opacity: 1 !important;
      transform: scale(1) !important;
    }

    .dismiss-continue-watching-button:hover {
      background: rgba(220, 38, 38, 0.9) !important;
      transform: scale(1.1) !important;
    }

    .dismiss-continue-watching-button:disabled {
      opacity: 0.6 !important;
      cursor: not-allowed !important;
      transform: scale(0.9) !important;
    }

    .dismiss-continue-watching-button .material-icons {
      color: white !important;
      font-size: 18px !important;
    }
  `;
  document.head.appendChild(style);

  /**
   * Mark an item as played using the Jellyfin ApiClient / REST API.
   * @param {string} itemId
   * @returns {Promise<void>}
   */
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

  /**
   * Add dismiss button to a card overlay container.
   * @param {Element} overlayContainer
   */
  function addDismissButton(overlayContainer) {
    if (overlayContainer.querySelector('.dismiss-continue-watching-button')) {
      return;
    }

    const card = overlayContainer.closest('.card');
    if (!card) {
      return;
    }

    // Continue Watching cards expose data-positionticks
    if (!card.getAttribute('data-positionticks')) {
      return;
    }

    const itemId = card.getAttribute('data-id');
    if (!itemId) {
      return;
    }

    const buttonContainer = overlayContainer.querySelector('.cardOverlayButton-br');
    if (!buttonContainer || !buttonContainer.parentNode) {
      return;
    }

    const dismissButton = document.createElement('button');
    dismissButton.type = 'button';
    dismissButton.className = 'dismiss-continue-watching-button';
    dismissButton.setAttribute('data-action', 'none');
    dismissButton.setAttribute('data-id', itemId);
    dismissButton.title = 'Mark as watched (remove from Continue Watching)';

    const icon = document.createElement('span');
    icon.className = 'material-icons';
    icon.textContent = 'close';
    icon.setAttribute('aria-hidden', 'true');
    dismissButton.appendChild(icon);

    dismissButton.addEventListener('click', async e => {
      e.preventDefault();
      e.stopPropagation();

      const originalIcon = icon.textContent;
      icon.textContent = 'hourglass_empty';
      dismissButton.disabled = true;

      try {
        await markItemPlayed(itemId);
        card.remove();
        console.log(`[DismissContinueWatching] Marked item ${itemId} as played`);
      } catch (error) {
        console.error('[DismissContinueWatching] Failed to mark as played:', error);
        icon.textContent = originalIcon;
        dismissButton.disabled = false;
        alert('Failed to remove from Continue Watching. Please try again.');
      }
    });

    buttonContainer.parentNode.insertBefore(dismissButton, buttonContainer);
  }

  function processExistingOverlayContainers() {
    document.querySelectorAll('.cardOverlayContainer').forEach(overlayContainer => {
      if (overlayContainer.querySelector('.cardOverlayButton-br')) {
        addDismissButton(overlayContainer);
      }
    });
  }

  function setupObserver() {
    const observer = new MutationObserver(mutations => {
      mutations.forEach(mutation => {
        if (mutation.type !== 'childList') {
          return;
        }

        mutation.addedNodes.forEach(node => {
          if (node.nodeType !== Node.ELEMENT_NODE) {
            return;
          }

          if (node.classList && node.classList.contains('cardOverlayContainer')) {
            if (node.querySelector('.cardOverlayButton-br')) {
              addDismissButton(node);
            }
          }

          if (node.querySelectorAll) {
            node.querySelectorAll('.cardOverlayContainer').forEach(overlayContainer => {
              if (overlayContainer.querySelector('.cardOverlayButton-br')) {
                addDismissButton(overlayContainer);
              }
            });
          }
        });
      });
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });

    processExistingOverlayContainers();
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
      console.log('[DismissContinueWatching] Ready');
    } catch (error) {
      console.error('[DismissContinueWatching] Initialization aborted:', error);
    }
  }

  init();
})();
