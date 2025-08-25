using Microsoft.AspNetCore.Routing;

namespace PlanCraft.Api.Endpoints;

public static class PhaseAssignmentRoutes
{
    public static void Map(IEndpointRouteBuilder api)
    {
        api.MapGet("/phases/{phaseId:int}/assignments", PhaseAssignmentHandlers.List);
        api.MapPost("/phases/{phaseId:int}/assignments", PhaseAssignmentHandlers.Create);
        api.MapPut("/phases/{phaseId:int}/assignments/{id:int}", PhaseAssignmentHandlers.Update);
        api.MapDelete("/phases/{phaseId:int}/assignments/{id:int}", PhaseAssignmentHandlers.Delete);
    }
}
