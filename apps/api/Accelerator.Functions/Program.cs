using Accelerator.Commands;
using Microsoft.Azure.Functions.Worker.Builder;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using OrderCloud.Catalyst;
using OrderCloud.SDK;
using System.Reflection;
using Accelerator.MockServices;
using Flurl.Util;
using Accelerator.Pelckmans;
using Azure.Storage.Blobs;
using Accelerator.Functions;

var builder = FunctionsApplication.CreateBuilder(args);

builder.ConfigureFunctionsWebApplication();
builder.Configuration.AddUserSecrets(Assembly.GetExecutingAssembly(), true);

var config = builder.Configuration;
// Add Services
builder.Services.AddSingleton<GreetingCommand>();
builder.Services.AddSingleton<ShippingCommand>();
builder.Services.AddSingleton<TaxCommand>();
builder.Services.AddSingleton<PaymentCommand>();

builder.Services.AddSingleton<IShippingRatesCalculator>(new ShippingServiceMock());
builder.Services.AddSingleton<ITaxCalculator>(new TaxServiceMock());
builder.Services.AddSingleton<ICreditCardProcessor>(new CreditCardProcessorMock());
builder.Services.AddSingleton<ICreditCardSaver>(new CreditCardSaverMock());

builder.Services.AddSingleton<IOrderCloudClient>(new OrderCloudClient(new OrderCloudClientConfig()
{
    ApiUrl = config.GetValue<string>("OrderCloudSettings:ApiUrl"),
    AuthUrl = config.GetValue<string>("OrderCloudSettings:ApiUrl"),
    ClientId = config.GetValue<string>("OrderCloudSettings:MiddlewareClientID"),
    ClientSecret = config.GetValue<string>("OrderCloudSettings:MiddlewareClientSecret"),
}));
builder.Services.AddHttpClient();
builder.Services.AddSingleton(new BlobContainerClient(
    config.GetConnectionString("PelckmansWorkflowStorage") ?? config["AzureWebJobsStorage"] ?? throw new InvalidOperationException("Workflow storage is not configured."),
    config["Pelckmans:StorageContainer"] ?? "pelckmans-offers"));
builder.Services.AddSingleton<IOfferStore, BlobOfferStore>();
builder.Services.AddSingleton<PelckmansAuth>();
builder.Services.AddSingleton<PelckmansPublisher>();


builder.Build().Run();
