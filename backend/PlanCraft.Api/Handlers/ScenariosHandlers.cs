using Microsoft.EntityFrameworkCore;

namespace PlanCraft.Api.Handlers;

public static class ScenariosHandlers
{
    public static Task<List<Scenario>> GetAll(PlanCraftDb db)
        => db.Scenarios.OrderByDescending(s => s.CreatedAt).ToListAsync();

    public static async Task<IResult> Create(PlanCraftDb db, Scenario s)
    {
        s.CreatedAt = DateTime.SpecifyKind(DateTime.UtcNow, DateTimeKind.Utc);
        db.Scenarios.Add(s);
        await db.SaveChangesAsync();
        return Results.Created($"/api/scenarios/{s.Id}", s);
    }

    public static async Task<IResult> AddOverride(PlanCraftDb db, int id, ScenarioTaskOverride o)
    {
        o.ScenarioId = id;
        db.ScenarioOverrides.Add(o);
        await db.SaveChangesAsync();
        return Results.Ok(o);
    }

    public static Task<List<ScenarioTaskOverride>> GetOverrides(PlanCraftDb db, int id)
        => db.ScenarioOverrides.Where(x => x.ScenarioId == id).ToListAsync();
}
