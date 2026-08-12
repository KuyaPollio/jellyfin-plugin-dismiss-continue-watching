using Jellyfin.Plugin.DismissContinueWatching.EventHandlers;
using Jellyfin.Plugin.DismissContinueWatching.Middleware;
using Jellyfin.Plugin.DismissContinueWatching.Services;
using MediaBrowser.Controller;
using MediaBrowser.Controller.Events;
using MediaBrowser.Controller.Library;
using MediaBrowser.Controller.Plugins;
using Microsoft.AspNetCore.Hosting;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;

namespace Jellyfin.Plugin.DismissContinueWatching;

/// <summary>
/// Register plugin services.
/// </summary>
public class PluginServiceRegistrator : IPluginServiceRegistrator
{
    /// <inheritdoc />
    public void RegisterServices(IServiceCollection serviceCollection, IServerApplicationHost applicationHost)
    {
        serviceCollection.AddSingleton<DenylistManager>();
        serviceCollection.AddScoped<IEventConsumer<PlaybackStartEventArgs>, PlaybackStartConsumer>();
        serviceCollection.AddHostedService<PluginEntryPoint>();
        serviceCollection.TryAddEnumerable(
            ServiceDescriptor.Transient<IStartupFilter, ResumeOverrideStartupFilter>());
    }
}
