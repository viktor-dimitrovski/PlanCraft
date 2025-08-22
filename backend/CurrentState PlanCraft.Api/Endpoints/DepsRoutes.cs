using Microsoft.AspNetCore.Routing;

namespace PlanCraft.Api.Endpoints;

public static class DepsRoutes
{
    public static void Map(IEndpointRouteBuilder api)
    {
        api.MapGet("/deps", DepsHandlers.GetAll);
        api.MapPost("/deps", DepsHandlers.Create);
        api.MapDelete("/deps/{id:int}", DepsHandlers.Delete);
    }
}
