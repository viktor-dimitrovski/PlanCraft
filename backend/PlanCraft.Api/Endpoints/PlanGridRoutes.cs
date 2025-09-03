using Microsoft.AspNetCore.Routing;
using PlanCraft.Api.Handlers;

namespace PlanCraft.Api.Endpoints;

public static class PlanGridRoutes
{
    public static void Map(IEndpointRouteBuilder api)
    {
        // ЕДЕН повик со се што е потребно за гридот (видлив прозорец)
        // GET /api/plan/grid?from=2025-01-01&to=2025-06-01
        api.MapGet("/plan/grid", PlanGridHandlers.GetGrid);
    }
}
