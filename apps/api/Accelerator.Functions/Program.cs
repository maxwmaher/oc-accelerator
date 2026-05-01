using Accelerator.Commands;
using Accelerator.MockServices;
using Flurl.Util;
using Microsoft.Azure.Functions.Worker.Builder;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using OrderCloud.Catalyst;
using OrderCloud.SDK;
using System;
using System.Linq;
using System.Collections.Generic;
using System.Reflection;

var builder = FunctionsApplication.CreateBuilder(args);

builder.ConfigureFunctionsWebApplication();
builder.Configuration.AddUserSecrets(Assembly.GetExecutingAssembly(), true);

var config = builder.Configuration;
var orderCloudClientConfig = BuildOrderCloudClientConfig(config);

// Add Services
builder.Services.AddSingleton<GreetingCommand>();
builder.Services.AddSingleton<ShippingCommand>();
builder.Services.AddSingleton<TaxCommand>();
builder.Services.AddSingleton<PaymentCommand>();

builder.Services.AddSingleton<IShippingRatesCalculator>(new ShippingServiceMock());
builder.Services.AddSingleton<ITaxCalculator>(new TaxServiceMock());
builder.Services.AddSingleton<ICreditCardProcessor>(new CreditCardProcessorMock());
builder.Services.AddSingleton<ICreditCardSaver>(new CreditCardSaverMock());

builder.Services.AddSingleton(orderCloudClientConfig);
builder.Services.AddSingleton<IOrderCloudClient>(_ => new OrderCloudClient(orderCloudClientConfig));

var app = builder.Build();

LogOrderCloudStartupConfiguration(app.Services, orderCloudClientConfig, config);

app.Run();

static OrderCloudClientConfig BuildOrderCloudClientConfig(IConfiguration config)
{
    var clientId = FirstNonEmpty(config,
        "OrderCloudSettings:ClientID",
        "OrderCloudSettings__ClientID",
        "ClientID",
        "OrderCloudSettings:MiddlewareClientID",
        "OrderCloudSettings__MiddlewareClientID");

    var clientSecret = FirstNonEmpty(config,
        "OrderCloudSettings:ClientSecret",
        "OrderCloudSettings__ClientSecret",
        "ClientSecret",
        "OrderCloudSettings:MiddlewareClientSecret",
        "OrderCloudSettings__MiddlewareClientSecret");

    var apiUrl = FirstNonEmpty(config,
        "OrderCloudSettings:ApiUrl",
        "OrderCloudSettings__ApiUrl",
        "ApiUrl");

    return new OrderCloudClientConfig
    {
        ApiUrl = apiUrl,
        AuthUrl = apiUrl,
        ClientId = clientId,
        ClientSecret = clientSecret,
        Roles = ResolveMiddlewareRoles(config.GetValue<string>("OrderCloudSettings:MiddlewareRoles")),
    };
}

static void LogOrderCloudStartupConfiguration(IServiceProvider services, OrderCloudClientConfig ocConfig, IConfiguration config)
{
    var logger = services.GetRequiredService<ILoggerFactory>().CreateLogger("OrderCloudStartup");
    var hasClientId = !string.IsNullOrWhiteSpace(ocConfig.ClientId);
    var hasClientSecret = !string.IsNullOrWhiteSpace(ocConfig.ClientSecret);
    var hasBaseApiUrl = !string.IsNullOrWhiteSpace(ocConfig.ApiUrl) || !string.IsNullOrWhiteSpace(ocConfig.AuthUrl);
    var rolesIncludeFullAccess = ocConfig.Roles?.Contains(ApiRole.FullAccess) == true;

    var clientIdPresence = GetPresenceMap(config,
        "OrderCloudSettings:ClientID",
        "OrderCloudSettings__ClientID",
        "ClientID",
        "OrderCloudSettings:MiddlewareClientID",
        "OrderCloudSettings__MiddlewareClientID");

    logger.LogInformation(
        "OrderCloud clientID presence OrderCloudSettings:ClientID={Path1} OrderCloudSettings__ClientID={Path2} ClientID={Path3} OrderCloudSettings:MiddlewareClientID={Path4} OrderCloudSettings__MiddlewareClientID={Path5}",
        clientIdPresence["OrderCloudSettings:ClientID"],
        clientIdPresence["OrderCloudSettings__ClientID"],
        clientIdPresence["ClientID"],
        clientIdPresence["OrderCloudSettings:MiddlewareClientID"],
        clientIdPresence["OrderCloudSettings__MiddlewareClientID"]);

    logger.LogInformation(
        "OrderCloud configuration check clientIDPresent={ClientIDPresent} clientSecretPresent={ClientSecretPresent} rolesIncludeFullAccess={RolesIncludeFullAccess} baseApiUrlPresent={BaseApiUrlPresent}",
        hasClientId,
        hasClientSecret,
        rolesIncludeFullAccess,
        hasBaseApiUrl);

    // Required Azure Function App / App Configuration settings:
    // - OrderCloudSettings:MiddlewareClientID
    // - OrderCloudSettings:MiddlewareClientSecret
    // - OrderCloudSettings:ApiUrl
    // - OrderCloudSettings:MiddlewareRoles (must include FullAccess; FullAccess is auto-added if omitted)
}


static string FirstNonEmpty(IConfiguration config, params string[] keys)
{
    foreach (var key in keys)
    {
        var value = config.GetValue<string>(key);
        if (!string.IsNullOrWhiteSpace(value))
        {
            return value;
        }
    }

    return null;
}

static Dictionary<string, bool> GetPresenceMap(IConfiguration config, params string[] keys)
{
    return keys.ToDictionary(key => key, key => !string.IsNullOrWhiteSpace(config.GetValue<string>(key)));
}

static ApiRole[] ResolveMiddlewareRoles(string configuredRoles)
{
    var parsedRoles = (configuredRoles ?? string.Empty)
        .Split(new[] { ' ', ',' }, StringSplitOptions.RemoveEmptyEntries)
        .Where(role => Enum.TryParse<ApiRole>(role, ignoreCase: true, out _))
        .Select(role => Enum.Parse<ApiRole>(role, ignoreCase: true))
        .Distinct()
        .ToList();

    if (!parsedRoles.Contains(ApiRole.FullAccess))
    {
        parsedRoles.Add(ApiRole.FullAccess);
    }

    return parsedRoles.ToArray();
}
