using Jellyfin.Plugin.DismissContinueWatching.Services;
using MediaBrowser.Controller.Events;
using MediaBrowser.Controller.Library;
using Microsoft.Extensions.Logging;

namespace Jellyfin.Plugin.DismissContinueWatching.EventHandlers;

/// <summary>
/// When playback starts again, allow the item back into Continue Watching.
/// </summary>
public class PlaybackStartConsumer : IEventConsumer<PlaybackStartEventArgs>
{
    private readonly ILogger<PlaybackStartConsumer> _logger;
    private readonly DenylistManager _denylistManager;

    /// <summary>
    /// Initializes a new instance of the <see cref="PlaybackStartConsumer"/> class.
    /// </summary>
    /// <param name="logger">Logger.</param>
    /// <param name="denylistManager">Denylist manager.</param>
    public PlaybackStartConsumer(
        ILogger<PlaybackStartConsumer> logger,
        DenylistManager denylistManager)
    {
        _logger = logger;
        _denylistManager = denylistManager;
    }

    /// <inheritdoc />
    public Task OnEvent(PlaybackStartEventArgs eventArgs)
    {
        try
        {
            if (eventArgs.Session is null || eventArgs.Item is null)
            {
                return Task.CompletedTask;
            }

            var userId = eventArgs.Session.UserId;
            var itemId = eventArgs.Item.Id.ToString("N");

            if (_denylistManager.Contains(userId, itemId))
            {
                _logger.LogInformation(
                    "Playback started for denylisted item {ItemId}; restoring to Continue Watching",
                    itemId);
                _denylistManager.Remove(userId, itemId);
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error handling playback start for dismiss denylist");
        }

        return Task.CompletedTask;
    }
}
