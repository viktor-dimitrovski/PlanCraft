using Microsoft.AspNetCore.Routing;

namespace PlanCraft.Api.Endpoints;

public static class ScenariosRoutes
{
    public static void Map(IEndpointRouteBuilder api)
    {
        api.MapGet("/scenarios", ScenariosHandlers.GetAll);
        api.MapPost("/scenarios", ScenariosHandlers.Create);
        api.MapPost("/scenarios/{id:int}/override", ScenariosHandlers.AddOverride);
        api.MapGet("/scenarios/{id:int}/overrides", ScenariosHandlers.GetOverrides);
    }
}
