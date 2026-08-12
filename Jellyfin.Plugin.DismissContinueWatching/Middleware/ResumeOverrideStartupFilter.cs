using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;

namespace Jellyfin.Plugin.DismissContinueWatching.Middleware;

/// <summary>
/// Inserts Resume override middleware at the start of the ASP.NET pipeline.
/// </summary>
public class ResumeOverrideStartupFilter : IStartupFilter
{
    /// <inheritdoc />
    public Action<IApplicationBuilder> Configure(Action<IApplicationBuilder> next)
    {
        return app =>
        {
            app.Use(async (context, nextMiddleware) =>
            {
                var middleware = new ResumeOverrideMiddleware(
                    _ => nextMiddleware(),
                    app.ApplicationServices.GetRequiredService<ILogger<ResumeOverrideMiddleware>>());
                await middleware.InvokeAsync(context);
            });
            next(app);
        };
    }
}
