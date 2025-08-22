using Microsoft.AspNetCore.Routing;

namespace PlanCraft.Api.Endpoints;

public static class PhasesRoutes
{
    public static void Map(IEndpointRouteBuilder api)
    {
        api.MapGet("/projects/{projectId:int}/phases", PhasesHandlers.GetByProject);
        api.MapPost("/projects/{projectId:int}/phases", PhasesHandlers.Create);
        api.MapPut("/phases/{id:int}", PhasesHandlers.Update);
        api.MapDelete("/phases/{id:int}", PhasesHandlers.Delete);
        api.MapDelete("/phases/{id:int}/plan", PhasesHandlers.DeletePlan);
        api.MapPost("/phases/{id:int}/plan", PhasesHandlers.PlanPhase);
    }
}
