using Microsoft.AspNetCore.Routing;

namespace PlanCraft.Api.Endpoints;

public static class BanksRoutes
{
    public static void Map(IEndpointRouteBuilder api)
    {
        api.MapGet("/banks", BanksHandlers.GetAll);
        api.MapPost("/banks", BanksHandlers.Create);
        api.MapPut("/banks/{id:int}", BanksHandlers.Update);
        api.MapDelete("/banks/{id:int}", BanksHandlers.Delete);
    }
}
