using Microsoft.AspNetCore.Routing;
using PlanCraft.Api.Handlers;

namespace PlanCraft.Api.Endpoints;

public static class TimeOffRoutes
{
    public static void Map(IEndpointRouteBuilder api)
    {
        api.MapGet("/timeoff", TimeOffHandlers.GetAll);
        api.MapPost("/timeoff", TimeOffHandlers.Create);
    }
}
