using Microsoft.AspNetCore.Routing;
using PlanCraft.Api.Handlers;

namespace PlanCraft.Api.Endpoints;

public static class PlanRoutes
{
    public static void Map(IEndpointRouteBuilder api)
    {
        api.MapGet("/plan/grid-phases", PlanHandlers.GetFullPlanByPhases);
        api.MapGet("/plan/tasks", PlanHandlers.GetFullPlanByTasks);
        api.MapPost("/plan/move", PlanHandlers.Move);
        api.MapPost("/plan/autobalance", PlanHandlers.AutoBalance);
        api.MapGet("/plan/compare", PlanHandlers.Compare);
        api.MapGet("/plan/forecast", PlanHandlers.Forecast);
    }
}
