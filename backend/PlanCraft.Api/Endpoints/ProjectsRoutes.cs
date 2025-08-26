using Microsoft.AspNetCore.Routing;

namespace PlanCraft.Api.Endpoints;

public static class ProjectsRoutes
{
    public static void Map(IEndpointRouteBuilder api)
    {
        api.MapGet("/projects", ProjectsHandlers.GetAll);
        api.MapPost("/projects", ProjectsHandlers.Create);
        api.MapPut("/projects/{id:int}", ProjectsHandlers.Update);
        api.MapDelete("/projects/{id:int}", ProjectsHandlers.Delete);
        api.MapPost("/projects/{sourceProjectId:int}/duplicate/{targetProjectId:int}", ProjectsHandlers.DuplicatePhases);
    }

}
