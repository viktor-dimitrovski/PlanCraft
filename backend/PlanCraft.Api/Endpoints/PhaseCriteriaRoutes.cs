using Microsoft.AspNetCore.Routing;

namespace PlanCraft.Api.Endpoints;

public static class PhaseCriteriaRoutes
{
    public static void Map(IEndpointRouteBuilder api)
    {
        api.MapGet("/phases/{phaseId:int}/criteria", PhaseCriteriaHandlers.List);
        api.MapPost("/phases/{phaseId:int}/criteria", PhaseCriteriaHandlers.Create);
        api.MapPut("/phases/{phaseId:int}/criteria/{id:int}", PhaseCriteriaHandlers.Update);
        api.MapDelete("/phases/{phaseId:int}/criteria/{id:int}", PhaseCriteriaHandlers.Delete);
        api.MapPatch("/criteria/{id:int}/status", PhaseCriteriaHandlers.SetStatusById);
        api.MapPatch("/phases/{phaseId:int}/criteria/{id:int}/status", PhaseCriteriaHandlers.SetStatus);
        api.MapPost("/phases/{phaseId:int}/criteria/reorder", PhaseCriteriaHandlers.Reorder);
    }
}
