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

LogOrderCloudStartupConfiguration(app.Services, orderCloudClientConfig);

app.Run();

static OrderCloudClientConfig BuildOrderCloudClientConfig(IConfiguration config)
{
    var apiUrl = config.GetValue<string>("OrderCloudSettings:ApiUrl");
    return new OrderCloudClientConfig
    {
        ApiUrl = apiUrl,
        AuthUrl = apiUrl,
        ClientId = config.GetValue<string>("OrderCloudSettings:MiddlewareClientID"),
        ClientSecret = config.GetValue<string>("OrderCloudSettings:MiddlewareClientSecret"),
        Roles = ResolveMiddlewareRoles(config.GetValue<string>("OrderCloudSettings:MiddlewareRoles")),
    };
}

static void LogOrderCloudStartupConfiguration(IServiceProvider services, OrderCloudClientConfig ocConfig)
{
    var logger = services.GetRequiredService<ILoggerFactory>().CreateLogger("OrderCloudStartup");
    var hasClientId = !string.IsNullOrWhiteSpace(ocConfig.ClientId);
    var hasClientSecret = !string.IsNullOrWhiteSpace(ocConfig.ClientSecret);
    var hasBaseApiUrl = !string.IsNullOrWhiteSpace(ocConfig.ApiUrl) || !string.IsNullOrWhiteSpace(ocConfig.AuthUrl);
    var rolesIncludeFullAccess = ocConfig.Roles?.Contains(ApiRole.FullAccess) == true;

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
