using System.ComponentModel.DataAnnotations;
using System.Security.Claims;
using Jellyfin.Data;
using Jellyfin.Data.Enums;
using Jellyfin.Database.Implementations.Enums;
using Jellyfin.Extensions;
using Jellyfin.Plugin.DismissContinueWatching.Api.Extensions;
using Jellyfin.Plugin.DismissContinueWatching.Api.ModelBinders;
using Jellyfin.Plugin.DismissContinueWatching.Services;
using MediaBrowser.Controller.Dto;
using MediaBrowser.Controller.Entities;
using MediaBrowser.Controller.Library;
using MediaBrowser.Controller.Session;
using MediaBrowser.Model.Dto;
using MediaBrowser.Model.Entities;
using MediaBrowser.Model.Querying;
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
    private readonly IUserManager _userManager;
    private readonly ILibraryManager _libraryManager;
    private readonly IDtoService _dtoService;
    private readonly ISessionManager _sessionManager;

    /// <summary>
    /// Initializes a new instance of the <see cref="DismissContinueWatchingController"/> class.
    /// </summary>
    /// <param name="logger">Logger.</param>
    /// <param name="denylistManager">Denylist manager.</param>
    /// <param name="userManager">User manager.</param>
    /// <param name="libraryManager">Library manager.</param>
    /// <param name="dtoService">DTO service.</param>
    /// <param name="sessionManager">Session manager.</param>
    public DismissContinueWatchingController(
        ILogger<DismissContinueWatchingController> logger,
        DenylistManager denylistManager,
        IUserManager userManager,
        ILibraryManager libraryManager,
        IDtoService dtoService,
        ISessionManager sessionManager)
    {
        _logger = logger;
        _denylistManager = denylistManager;
        _userManager = userManager;
        _libraryManager = libraryManager;
        _dtoService = dtoService;
        _sessionManager = sessionManager;
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

    /// <summary>
    /// Override for the legacy "Users/{userId}/Items/Resume" endpoint.
    /// </summary>
    /// <param name="userId">The user id.</param>
    /// <param name="startIndex">The start index.</param>
    /// <param name="limit">The item limit.</param>
    /// <param name="searchTerm">The search term.</param>
    /// <param name="parentId">Parent folder id.</param>
    /// <param name="fields">Additional item fields.</param>
    /// <param name="mediaTypes">Media types filter.</param>
    /// <param name="enableUserData">Include user data.</param>
    /// <param name="imageTypeLimit">Image type limit.</param>
    /// <param name="enableImageTypes">Enabled image types.</param>
    /// <param name="excludeItemTypes">Excluded item types.</param>
    /// <param name="includeItemTypes">Included item types.</param>
    /// <param name="enableTotalRecordCount">Enable total record count.</param>
    /// <param name="enableImages">Include images.</param>
    /// <param name="excludeActiveSessions">Exclude active sessions.</param>
    /// <returns>Filtered resumable items.</returns>
    [HttpGet("Override/Users/{userId}/Items/Resume")]
    [Obsolete("Kept for backwards compatibility")]
    [ApiExplorerSettings(IgnoreApi = true)]
    [ProducesResponseType(StatusCodes.Status200OK)]
    public ActionResult<QueryResult<BaseItemDto>> GetResumeItemsLegacy(
        [FromRoute, Required] Guid userId,
        [FromQuery] int? startIndex,
        [FromQuery] int? limit,
        [FromQuery] string? searchTerm,
        [FromQuery] Guid? parentId,
        [FromQuery, ModelBinder(typeof(CommaDelimitedCollectionModelBinder))] ItemFields[] fields,
        [FromQuery, ModelBinder(typeof(CommaDelimitedCollectionModelBinder))] MediaType[] mediaTypes,
        [FromQuery] bool? enableUserData,
        [FromQuery] int? imageTypeLimit,
        [FromQuery, ModelBinder(typeof(CommaDelimitedCollectionModelBinder))] ImageType[] enableImageTypes,
        [FromQuery, ModelBinder(typeof(CommaDelimitedCollectionModelBinder))] BaseItemKind[] excludeItemTypes,
        [FromQuery, ModelBinder(typeof(CommaDelimitedCollectionModelBinder))] BaseItemKind[] includeItemTypes,
        [FromQuery] bool enableTotalRecordCount = true,
        [FromQuery] bool? enableImages = true,
        [FromQuery] bool excludeActiveSessions = false)
        => GetResumeItems(
            userId,
            startIndex,
            limit,
            searchTerm,
            parentId,
            fields,
            mediaTypes,
            enableUserData,
            imageTypeLimit,
            enableImageTypes,
            excludeItemTypes,
            includeItemTypes,
            enableTotalRecordCount,
            enableImages,
            excludeActiveSessions);

    /// <summary>
    /// Override for the "UserItems/Resume" endpoint.
    /// </summary>
    /// <param name="userId">The user id.</param>
    /// <param name="startIndex">The start index.</param>
    /// <param name="limit">The item limit.</param>
    /// <param name="searchTerm">The search term.</param>
    /// <param name="parentId">Parent folder id.</param>
    /// <param name="fields">Additional item fields.</param>
    /// <param name="mediaTypes">Media types filter.</param>
    /// <param name="enableUserData">Include user data.</param>
    /// <param name="imageTypeLimit">Image type limit.</param>
    /// <param name="enableImageTypes">Enabled image types.</param>
    /// <param name="excludeItemTypes">Excluded item types.</param>
    /// <param name="includeItemTypes">Included item types.</param>
    /// <param name="enableTotalRecordCount">Enable total record count.</param>
    /// <param name="enableImages">Include images.</param>
    /// <param name="excludeActiveSessions">Exclude active sessions.</param>
    /// <returns>Filtered resumable items.</returns>
    [HttpGet("Override/UserItems/Resume")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    public ActionResult<QueryResult<BaseItemDto>> GetResumeItems(
        [FromQuery] Guid? userId,
        [FromQuery] int? startIndex,
        [FromQuery] int? limit,
        [FromQuery] string? searchTerm,
        [FromQuery] Guid? parentId,
        [FromQuery, ModelBinder(typeof(CommaDelimitedCollectionModelBinder))] ItemFields[] fields,
        [FromQuery, ModelBinder(typeof(CommaDelimitedCollectionModelBinder))] MediaType[] mediaTypes,
        [FromQuery] bool? enableUserData,
        [FromQuery] int? imageTypeLimit,
        [FromQuery, ModelBinder(typeof(CommaDelimitedCollectionModelBinder))] ImageType[] enableImageTypes,
        [FromQuery, ModelBinder(typeof(CommaDelimitedCollectionModelBinder))] BaseItemKind[] excludeItemTypes,
        [FromQuery, ModelBinder(typeof(CommaDelimitedCollectionModelBinder))] BaseItemKind[] includeItemTypes,
        [FromQuery] bool enableTotalRecordCount = true,
        [FromQuery] bool? enableImages = true,
        [FromQuery] bool excludeActiveSessions = false)
    {
        var requestUserId = GetUserId();
        if (requestUserId == Guid.Empty)
        {
            _logger.LogWarning("Unable to determine user ID from request");
            return Unauthorized();
        }

        var effectiveUserId = userId ?? requestUserId;
        var user = _userManager.GetUserById(effectiveUserId);
        if (user is null)
        {
            return NotFound();
        }

        var parentIdGuid = parentId ?? Guid.Empty;
        var dtoOptions = new DtoOptions { Fields = fields }
            .AddClientFields(User)
            .AddAdditionalDtoOptions(enableImages, enableUserData, imageTypeLimit, enableImageTypes);

        var ancestorIds = Array.Empty<Guid>();

        var excludeFolderIds = user.GetPreferenceValues<Guid>(PreferenceKind.LatestItemExcludes);
        if (parentIdGuid.IsEmpty() && excludeFolderIds.Length > 0)
        {
            ancestorIds = _libraryManager.GetUserRootFolder().GetChildren(user, true)
                .Where(i => i is Folder)
                .Where(i => !excludeFolderIds.Contains(i.Id))
                .Select(i => i.Id)
                .ToArray();
        }

        var excludeItemIds = Array.Empty<Guid>();
        if (excludeActiveSessions)
        {
            excludeItemIds = _sessionManager.Sessions
                .Where(s => s.UserId.Equals(requestUserId) && s.NowPlayingItem is not null)
                .Select(s => s.NowPlayingItem.Id)
                .ToArray();
        }

        var denylistedItems = _denylistManager.Get(requestUserId)
            .Select(id => Guid.TryParse(id, out var guid) ? guid : Guid.Empty)
            .Where(id => id != Guid.Empty);
        excludeItemIds = excludeItemIds.Concat(denylistedItems).ToArray();

        var itemsResult = _libraryManager.GetItemsResult(new InternalItemsQuery(user)
        {
            OrderBy = new[] { (ItemSortBy.DatePlayed, SortOrder.Descending) },
            IsResumable = true,
            StartIndex = startIndex,
            Limit = limit,
            ParentId = parentIdGuid,
            Recursive = true,
            DtoOptions = dtoOptions,
            MediaTypes = mediaTypes,
            IsVirtualItem = false,
            CollapseBoxSetItems = false,
            IncludeOwnedItems = true,
            EnableTotalRecordCount = enableTotalRecordCount,
            AncestorIds = ancestorIds,
            IncludeItemTypes = includeItemTypes,
            ExcludeItemTypes = excludeItemTypes,
            SearchTerm = searchTerm,
            ExcludeItemIds = excludeItemIds
        });

        IReadOnlyList<BaseItemDto> returnItems = _dtoService.GetBaseItemDtos(
            itemsResult.Items,
            dtoOptions,
            user,
            owner: null,
            skipVisibilityCheck: true);

        return new QueryResult<BaseItemDto>(
            startIndex,
            itemsResult.TotalRecordCount,
            returnItems);
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
