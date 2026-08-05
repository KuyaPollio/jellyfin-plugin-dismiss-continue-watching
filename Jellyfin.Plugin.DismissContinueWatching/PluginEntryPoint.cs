using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace Jellyfin.Plugin.DismissContinueWatching;

/// <summary>
/// Plugin entry point that runs when the server starts.
/// </summary>
public sealed class PluginEntryPoint : IHostedService
{
    private const int MaxRegistrationAttempts = 12;
    private static readonly TimeSpan RetryDelay = TimeSpan.FromSeconds(5);

    private readonly ILogger<PluginEntryPoint> _logger;
    private int _registrationAttempts;

    /// <summary>
    /// Initializes a new instance of the <see cref="PluginEntryPoint"/> class.
    /// </summary>
    /// <param name="logger">The logger.</param>
    public PluginEntryPoint(ILogger<PluginEntryPoint> logger)
    {
        _logger = logger;
    }

    /// <inheritdoc />
    public Task StartAsync(CancellationToken cancellationToken)
    {
        _logger.LogInformation("DismissContinueWatching plugin is starting");
        TryRegisterJavascript();
        return Task.CompletedTask;
    }

    /// <inheritdoc />
    public Task StopAsync(CancellationToken cancellationToken)
    {
        return Task.CompletedTask;
    }

    private void TryRegisterJavascript()
    {
        _registrationAttempts++;

        try
        {
            var registered = DismissContinueWatchingPlugin.Instance?.RegisterJavascript() == true;
            if (registered)
            {
                return;
            }

            _logger.LogInformation(
                "JavaScript Injector not ready (attempt {Attempt}/{Max}). Retrying...",
                _registrationAttempts,
                MaxRegistrationAttempts);
            ScheduleRetry();
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "JavaScript registration attempt {Attempt} failed", _registrationAttempts);
            ScheduleRetry();
        }
    }

    private void ScheduleRetry()
    {
        if (_registrationAttempts >= MaxRegistrationAttempts)
        {
            _logger.LogError(
                "Gave up registering with JavaScript Injector after {Attempts} attempts",
                _registrationAttempts);
            return;
        }

        _ = Task.Run(async () =>
        {
            await Task.Delay(RetryDelay).ConfigureAwait(false);
            TryRegisterJavascript();
        });
    }
}
