using Microsoft.AspNetCore.Routing;

namespace PlanCraft.Api.Endpoints;

public static class PhaseVerificationRoutes
{
    public static void Map(IEndpointRouteBuilder api)
    {
        api.MapPost("/phases/{phaseId:int}/verify/start", PhaseVerificationHandlers.StartRun);
        api.MapPost("/phases/{phaseId:int}/verify/{runId:int}/result", PhaseVerificationHandlers.UpsertResult);
        api.MapPost("/phases/{phaseId:int}/verify/{runId:int}/finalize", PhaseVerificationHandlers.FinalizeRun);
        api.MapGet("/phases/{phaseId:int}/progress", PhaseVerificationHandlers.Progress);
    }
}
