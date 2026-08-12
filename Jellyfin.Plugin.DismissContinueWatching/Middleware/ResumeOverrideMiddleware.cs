using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Logging;

namespace Jellyfin.Plugin.DismissContinueWatching.Middleware;

/// <summary>
/// Rewrites native Resume API paths to the plugin override endpoint so filtering
/// works for all clients without reverse-proxy configuration.
/// </summary>
public class ResumeOverrideMiddleware
{
    private readonly RequestDelegate _next;
    private readonly ILogger<ResumeOverrideMiddleware> _logger;

    /// <summary>
    /// Initializes a new instance of the <see cref="ResumeOverrideMiddleware"/> class.
    /// </summary>
    /// <param name="next">Next middleware.</param>
    /// <param name="logger">Logger.</param>
    public ResumeOverrideMiddleware(RequestDelegate next, ILogger<ResumeOverrideMiddleware> logger)
    {
        _next = next;
        _logger = logger;
    }

    /// <summary>
    /// Rewrites Resume requests to the plugin override route.
    /// </summary>
    /// <param name="context">HTTP context.</param>
    /// <returns>A task.</returns>
    public Task InvokeAsync(HttpContext context)
    {
        if (!HttpMethods.IsGet(context.Request.Method))
        {
            return _next(context);
        }

        var path = context.Request.Path.Value ?? string.Empty;
        if (TryGetRewritePath(path, out var rewritePath))
        {
            _logger.LogDebug("Rewriting Resume request {From} -> {To}", path, rewritePath);
            context.Request.Path = new PathString(rewritePath);
        }

        return _next(context);
    }

    private static bool TryGetRewritePath(string path, out string rewritePath)
    {
        rewritePath = string.Empty;
        var trimmed = path.Trim('/');
        if (string.IsNullOrEmpty(trimmed))
        {
            return false;
        }

        var parts = trimmed.Split('/');

        if (parts.Length == 2
            && string.Equals(parts[0], "UserItems", StringComparison.OrdinalIgnoreCase)
            && string.Equals(parts[1], "Resume", StringComparison.OrdinalIgnoreCase))
        {
            rewritePath = "/DismissContinueWatching/Override/UserItems/Resume";
            return true;
        }

        if (parts.Length >= 4
            && string.Equals(parts[0], "Users", StringComparison.OrdinalIgnoreCase)
            && string.Equals(parts[2], "Items", StringComparison.OrdinalIgnoreCase)
            && string.Equals(parts[3], "Resume", StringComparison.OrdinalIgnoreCase))
        {
            rewritePath = $"/DismissContinueWatching/Override/Users/{parts[1]}/Items/Resume";
            return true;
        }

        // Base URL prefix, e.g. /jellyfin/UserItems/Resume
        if (parts.Length == 3
            && string.Equals(parts[1], "UserItems", StringComparison.OrdinalIgnoreCase)
            && string.Equals(parts[2], "Resume", StringComparison.OrdinalIgnoreCase))
        {
            rewritePath = $"/{parts[0]}/DismissContinueWatching/Override/UserItems/Resume";
            return true;
        }

        if (parts.Length >= 5
            && string.Equals(parts[1], "Users", StringComparison.OrdinalIgnoreCase)
            && string.Equals(parts[3], "Items", StringComparison.OrdinalIgnoreCase)
            && string.Equals(parts[4], "Resume", StringComparison.OrdinalIgnoreCase))
        {
            rewritePath = $"/{parts[0]}/DismissContinueWatching/Override/Users/{parts[2]}/Items/Resume";
            return true;
        }

        return false;
    }
}
