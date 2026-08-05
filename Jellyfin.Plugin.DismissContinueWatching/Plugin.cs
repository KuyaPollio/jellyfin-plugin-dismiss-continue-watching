using System.Reflection;
using System.Runtime.Loader;
using Jellyfin.Plugin.DismissContinueWatching.Configuration;
using MediaBrowser.Common.Configuration;
using MediaBrowser.Common.Plugins;
using MediaBrowser.Model.Plugins;
using MediaBrowser.Model.Serialization;
using Microsoft.Extensions.Logging;
using Newtonsoft.Json.Linq;

namespace Jellyfin.Plugin.DismissContinueWatching;

/// <summary>
/// The main plugin.
/// </summary>
public class DismissContinueWatchingPlugin : BasePlugin<PluginConfiguration>, IHasWebPages
{
    private readonly ILogger<DismissContinueWatchingPlugin> _logger;

    /// <summary>
    /// Initializes a new instance of the <see cref="DismissContinueWatchingPlugin"/> class.
    /// </summary>
    /// <param name="applicationPaths">Instance of the <see cref="IApplicationPaths"/> interface.</param>
    /// <param name="xmlSerializer">Instance of the <see cref="IXmlSerializer"/> interface.</param>
    /// <param name="logger">Instance of the <see cref="ILogger{DismissContinueWatchingPlugin}"/> interface.</param>
    public DismissContinueWatchingPlugin(
        IApplicationPaths applicationPaths,
        IXmlSerializer xmlSerializer,
        ILogger<DismissContinueWatchingPlugin> logger)
        : base(applicationPaths, xmlSerializer)
    {
        Instance = this;
        _logger = logger;
    }

    /// <inheritdoc />
    public override string Name => "DismissContinueWatching";

    /// <inheritdoc />
    public override Guid Id => Guid.Parse("d07fb0c0-4da7-45c3-b14b-c4b4dc644a88");

    /// <summary>
    /// Gets the current plugin instance.
    /// </summary>
    public static DismissContinueWatchingPlugin? Instance { get; private set; }

    /// <summary>
    /// Registers the JavaScript with the JavaScript Injector plugin.
    /// </summary>
    /// <returns><c>true</c> when registration succeeded; otherwise <c>false</c>.</returns>
    public bool RegisterJavascript()
    {
        try
        {
            Assembly? jsInjectorAssembly = AssemblyLoadContext.All
                .SelectMany(x => x.Assemblies)
                .FirstOrDefault(x =>
                    string.Equals(
                        x.GetName().Name,
                        "Jellyfin.Plugin.JavaScriptInjector",
                        StringComparison.Ordinal));

            if (jsInjectorAssembly is null)
            {
                _logger.LogWarning(
                    "JavaScript Injector plugin not found yet. Install/enable it for the Continue Watching dismiss button.");
                return false;
            }

            var customScriptPath = $"{Assembly.GetExecutingAssembly().GetName().Name}.Web.dismiss-continue-watching.js";
            using var scriptStream = Assembly.GetExecutingAssembly().GetManifestResourceStream(customScriptPath);
            if (scriptStream is null)
            {
                _logger.LogError("Could not find embedded script at path: {Path}", customScriptPath);
                return false;
            }

            using var reader = new StreamReader(scriptStream);
            var scriptContent = reader.ReadToEnd();

            Type? pluginInterfaceType = jsInjectorAssembly.GetType("Jellyfin.Plugin.JavaScriptInjector.PluginInterface");
            if (pluginInterfaceType is null)
            {
                _logger.LogError("Could not find PluginInterface type in JavaScript Injector assembly.");
                return false;
            }

            // Drop previous Injector entries so upgrades always refresh script body
            pluginInterfaceType
                .GetMethod("UnregisterAllScriptsFromPlugin")
                ?.Invoke(null, [Id.ToString()]);

            var scriptRegistration = new JObject
            {
                { "id", $"{Id}-script-v{Version}" },
                { "name", $"DismissContinueWatching Client Script v{Version}" },
                { "script", scriptContent },
                { "enabled", true },
                { "requiresAuthentication", true },
                { "pluginId", Id.ToString() },
                { "pluginName", Name },
                { "pluginVersion", Version.ToString() }
            };

            var registerResult = pluginInterfaceType.GetMethod("RegisterScript")?.Invoke(null, [scriptRegistration]);

            if (registerResult is bool success && success)
            {
                _logger.LogInformation("Successfully registered JavaScript with JavaScript Injector plugin.");
                return true;
            }

            _logger.LogWarning("Failed to register JavaScript with JavaScript Injector plugin.");
            return false;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to register JavaScript with JavaScript Injector plugin.");
            return false;
        }
    }

    /// <inheritdoc />
    public override void OnUninstalling()
    {
        try
        {
            Assembly? jsInjectorAssembly = AssemblyLoadContext.All
                .SelectMany(x => x.Assemblies)
                .FirstOrDefault(x =>
                    string.Equals(
                        x.GetName().Name,
                        "Jellyfin.Plugin.JavaScriptInjector",
                        StringComparison.Ordinal));

            if (jsInjectorAssembly is not null)
            {
                Type? pluginInterfaceType = jsInjectorAssembly.GetType("Jellyfin.Plugin.JavaScriptInjector.PluginInterface");
                if (pluginInterfaceType is not null)
                {
                    var unregisterResult = pluginInterfaceType
                        .GetMethod("UnregisterAllScriptsFromPlugin")
                        ?.Invoke(null, [Id.ToString()]);

                    if (unregisterResult is int removedCount)
                    {
                        _logger.LogInformation(
                            "Successfully unregistered {Count} script(s) from JavaScript Injector plugin.",
                            removedCount);
                    }
                }
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to unregister JavaScript scripts.");
        }

        base.OnUninstalling();
    }

    /// <inheritdoc />
    public IEnumerable<PluginPageInfo> GetPages()
    {
        var prefix = GetType().Namespace;

        return
        [
            new PluginPageInfo
            {
                Name = Name,
                EmbeddedResourcePath = $"{prefix}.Pages.Info.index.html"
            },
            new PluginPageInfo
            {
                Name = "Info.js",
                EmbeddedResourcePath = $"{prefix}.Pages.Info.index.js"
            }
        ];
    }
}
