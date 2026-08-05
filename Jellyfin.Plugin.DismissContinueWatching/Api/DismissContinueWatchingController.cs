using System.ComponentModel.DataAnnotations;
using System.Security.Claims;
using Jellyfin.Plugin.DismissContinueWatching.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Logging;

namespace Jellyfin.Plugin.DismissContinueWatching.Api;

/// <summary>
/// Persistently hide items from Continue Watching.
/// </summary>
[ApiController]
[Route("DismissContinueWatching")]
[Authorize]
public class DismissContinueWatchingController : ControllerBase
{
    private readonly ILogger<DismissContinueWatchingController> _logger;
    private readonly DenylistManager _denylistManager;

    /// <summary>
    /// Initializes a new instance of the <see cref="DismissContinueWatchingController"/> class.
    /// </summary>
    /// <param name="logger">Logger.</param>
    /// <param name="denylistManager">Denylist manager.</param>
    public DismissContinueWatchingController(
        ILogger<DismissContinueWatchingController> logger,
        DenylistManager denylistManager)
    {
        _logger = logger;
        _denylistManager = denylistManager;
    }

    /// <summary>
    /// Gets denylisted item ids for the current user.
    /// </summary>
    /// <returns>Item ids.</returns>
    [HttpGet("Items")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public ActionResult<IReadOnlyList<string>> GetItems()
    {
        var userId = GetUserId();
        if (userId == Guid.Empty)
        {
            return Unauthorized();
        }

        return Ok(_denylistManager.Get(userId));
    }

    /// <summary>
    /// Adds an item to the dismiss denylist.
    /// </summary>
    /// <param name="itemId">Item id.</param>
    /// <returns>OK.</returns>
    [HttpPost("Items/{itemId}")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public ActionResult AddItem([FromRoute, Required] string itemId)
    {
        var userId = GetUserId();
        if (userId == Guid.Empty)
        {
            return Unauthorized();
        }

        _denylistManager.Add(userId, itemId);
        return Ok();
    }

    /// <summary>
    /// Removes an item from the dismiss denylist.
    /// </summary>
    /// <param name="itemId">Item id.</param>
    /// <returns>OK.</returns>
    [HttpDelete("Items/{itemId}")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public ActionResult RemoveItem([FromRoute, Required] string itemId)
    {
        var userId = GetUserId();
        if (userId == Guid.Empty)
        {
            return Unauthorized();
        }

        _denylistManager.Remove(userId, itemId);
        return Ok();
    }

    private Guid GetUserId()
    {
        if (User.Identity is not ClaimsIdentity identity)
        {
            return Guid.Empty;
        }

        var claim = identity.FindFirst("Jellyfin-UserId");
        return claim is not null && Guid.TryParse(claim.Value, out var userId)
            ? userId
            : Guid.Empty;
    }
}
