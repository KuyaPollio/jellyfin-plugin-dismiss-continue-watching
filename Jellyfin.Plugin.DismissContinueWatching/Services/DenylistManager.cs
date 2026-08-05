using System.Collections.ObjectModel;
using Microsoft.Extensions.Logging;

namespace Jellyfin.Plugin.DismissContinueWatching.Services;

/// <summary>
/// Persists per-user item IDs hidden from Continue Watching.
/// </summary>
public class DenylistManager
{
    private readonly ILogger<DenylistManager> _logger;

    /// <summary>
    /// Initializes a new instance of the <see cref="DenylistManager"/> class.
    /// </summary>
    /// <param name="logger">Logger.</param>
    public DenylistManager(ILogger<DenylistManager> logger)
    {
        _logger = logger;
    }

    /// <summary>
    /// Normalize Jellyfin item ids to a dash-less lowercase form.
    /// </summary>
    /// <param name="itemId">Raw item id.</param>
    /// <returns>Normalized id.</returns>
    public static string NormalizeItemId(string itemId)
        => itemId.Replace("-", string.Empty, StringComparison.Ordinal).ToLowerInvariant();

    /// <summary>
    /// Adds an item to the user's denylist.
    /// </summary>
    /// <param name="userId">User id.</param>
    /// <param name="itemId">Item id.</param>
    public void Add(Guid userId, string itemId)
    {
        var config = DismissContinueWatchingPlugin.Instance?.Configuration;
        if (config is null)
        {
            _logger.LogError("Plugin configuration is not available");
            return;
        }

        var normalized = NormalizeItemId(itemId);
        var list = config.UserDenylists.GetOrAdd(userId, static _ => new Collection<string>());

        lock (list)
        {
            if (list.Any(id => string.Equals(NormalizeItemId(id), normalized, StringComparison.Ordinal)))
            {
                return;
            }

            list.Add(normalized);
            DismissContinueWatchingPlugin.Instance?.SaveConfiguration();
            _logger.LogInformation("Added item {ItemId} to dismiss denylist for user {UserId}", normalized, userId);
        }
    }

    /// <summary>
    /// Removes an item from the user's denylist.
    /// </summary>
    /// <param name="userId">User id.</param>
    /// <param name="itemId">Item id.</param>
    public void Remove(Guid userId, string itemId)
    {
        var config = DismissContinueWatchingPlugin.Instance?.Configuration;
        if (config is null)
        {
            return;
        }

        if (!config.UserDenylists.TryGetValue(userId, out var list))
        {
            return;
        }

        var normalized = NormalizeItemId(itemId);
        lock (list)
        {
            var existing = list.FirstOrDefault(id => string.Equals(NormalizeItemId(id), normalized, StringComparison.Ordinal));
            if (existing is null)
            {
                return;
            }

            list.Remove(existing);
            if (list.Count == 0)
            {
                config.UserDenylists.TryRemove(userId, out _);
            }

            DismissContinueWatchingPlugin.Instance?.SaveConfiguration();
            _logger.LogInformation("Removed item {ItemId} from dismiss denylist for user {UserId}", normalized, userId);
        }
    }

    /// <summary>
    /// Gets denylisted item ids for a user.
    /// </summary>
    /// <param name="userId">User id.</param>
    /// <returns>Item ids.</returns>
    public IReadOnlyList<string> Get(Guid userId)
    {
        var config = DismissContinueWatchingPlugin.Instance?.Configuration;
        if (config is null || !config.UserDenylists.TryGetValue(userId, out var list))
        {
            return Array.Empty<string>();
        }

        lock (list)
        {
            return list.Select(NormalizeItemId).Distinct(StringComparer.Ordinal).ToArray();
        }
    }

    /// <summary>
    /// Returns whether an item is denylisted for the user.
    /// </summary>
    /// <param name="userId">User id.</param>
    /// <param name="itemId">Item id.</param>
    /// <returns>True when denylisted.</returns>
    public bool Contains(Guid userId, string itemId)
    {
        var normalized = NormalizeItemId(itemId);
        return Get(userId).Any(id => string.Equals(id, normalized, StringComparison.Ordinal));
    }
}
