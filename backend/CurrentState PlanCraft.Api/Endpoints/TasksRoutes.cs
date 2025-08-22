using Microsoft.AspNetCore.Routing;

namespace PlanCraft.Api.Endpoints;

public static class TasksRoutes
{
    public static void Map(IEndpointRouteBuilder api)
    {
        api.MapGet("/tasks", TasksHandlers.GetAll);
        api.MapPost("/tasks", TasksHandlers.Create);
        api.MapPut("/tasks/{id:int}", TasksHandlers.Update);
        api.MapDelete("/tasks/{id:int}", TasksHandlers.Delete);
    }
}
