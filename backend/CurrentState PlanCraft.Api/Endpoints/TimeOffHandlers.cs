using Microsoft.AspNetCore.Routing;

namespace PlanCraft.Api.Endpoints;

public static class HolidaysRoutes
{
    public static void Map(IEndpointRouteBuilder api)
    {
        api.MapGet("/holidays", HolidaysHandlers.GetAll);
        api.MapPost("/holidays", HolidaysHandlers.Create);
    }
}
