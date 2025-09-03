using Microsoft.AspNetCore.Routing;
using PlanCraft.Api.Handlers;

namespace PlanCraft.Api.Endpoints;

public static class AssignmentsRoutes
{
    public static void Map(IEndpointRouteBuilder api)
    {
        api.MapGet("/assignments", AssignmentsHandlers.GetAll);
        api.MapPost("/assignments", AssignmentsHandlers.Create);
        api.MapPut("/assignments/{id:int}", AssignmentsHandlers.Update);
        api.MapDelete("/assignments/{id:int}", AssignmentsHandlers.Delete);
    }
}
