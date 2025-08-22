using Microsoft.AspNetCore.Routing;

namespace PlanCraft.Api.Endpoints;

public static class ApiRouteMap
{
    public static void Map(IEndpointRouteBuilder api)
    {
        PeopleRoutes.Map(api);
        BanksRoutes.Map(api);
        ProjectsRoutes.Map(api);
        PhasesRoutes.Map(api);
        TasksRoutes.Map(api);
        AssignmentsRoutes.Map(api);
        DepsRoutes.Map(api);
        TimeOffRoutes.Map(api);
        ScenariosRoutes.Map(api);
        PlanRoutes.Map(api);
    }
}
