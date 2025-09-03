using Microsoft.AspNetCore.Routing;
using PlanCraft.Api.Handlers;

namespace PlanCraft.Api.Endpoints;

public static class PeopleRoutes
{
    public static void Map(IEndpointRouteBuilder api)
    {
        api.MapGet("/people", PeopleHandlers.GetAll);
        api.MapPost("/people", PeopleHandlers.Create);
        api.MapPut("/people/{id:int}", PeopleHandlers.Update);
        api.MapDelete("/people/{id:int}", PeopleHandlers.Delete);
    }
}
