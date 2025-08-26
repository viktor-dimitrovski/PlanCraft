using Microsoft.EntityFrameworkCore;
using PlanCraft.Api;
using Serilog;
using System.Text.Json.Serialization;
using PlanCraft.Api.Endpoints;

var builder = WebApplication.CreateBuilder(args);

// Logging
builder.Host.UseSerilog((ctx, lc) =>
    lc.ReadFrom.Configuration(ctx.Configuration).WriteTo.Console());

// Config / connection
builder.Configuration.AddEnvironmentVariables();
var connStr = builder.Configuration.GetConnectionString("Postgres")
              ?? builder.Configuration["ConnectionStrings__Postgres"]
              ?? "Host=localhost;Port=5432;Database=plancraft;Username=postgres;Password=postgres";

// Services
builder.Services.AddDbContext<PlanCraftDb>(opt => opt.UseNpgsql(connStr));
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

builder.Services.AddCors(opt =>
{
    opt.AddPolicy("ui", p => p
        .WithOrigins("http://localhost:5173", "http://localhost:5174")
        .AllowAnyHeader().AllowAnyMethod());
});

builder.Services.ConfigureHttpJsonOptions(o =>
{
    o.SerializerOptions.ReferenceHandler = ReferenceHandler.IgnoreCycles;
    o.SerializerOptions.DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull;
});

//builder.Services.AddControllers()
//    .AddJsonOptions(options =>
//    {
//        options.JsonSerializerOptions.ReferenceHandler = System.Text.Json.Serialization.ReferenceHandler.IgnoreCycles;
//    });

var app = builder.Build();

// Middleware
app.UseCors("ui");
app.UseSwagger();
app.UseSwaggerUI();

app.Use(async (ctx, next) =>
{
    try { await next(); }
    catch (Exception ex)
    {
        Log.Error(ex, "Unhandled");
        ctx.Response.StatusCode = 500;
        await ctx.Response.WriteAsJsonAsync(new { error = ex.Message });
    }
});

// DB migrate & optional seed
using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<PlanCraftDb>();
    db.Database.Migrate();
    // if (!db.People.Any()) Seed.Load(db, Path.Combine(app.Environment.ContentRootPath, "data", "seed.json"));
}

// Routes (all in one place)
var api = app.MapGroup("/api");
ApiRouteMap.Map(api);

app.Run();
