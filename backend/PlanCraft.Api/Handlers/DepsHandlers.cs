using Microsoft.EntityFrameworkCore;

namespace PlanCraft.Api.Endpoints;

public static class DepsHandlers
{
    public static Task<List<TaskDependency>> GetAll(PlanCraftDb db)
        => db.TaskDependencies.ToListAsync();

    public static async Task<IResult> Create(PlanCraftDb db, TaskDependency d)
    {
        db.TaskDependencies.Add(d);
        await db.SaveChangesAsync();
        return Results.Created($"/api/deps/{d.Id}", d);
    }

    public static async Task<IResult> Delete(PlanCraftDb db, int id)
    {
        var d = await db.TaskDependencies.FindAsync(id);
        if (d == null) return Results.NotFound();
        db.Remove(d);
        await db.SaveChangesAsync();
        return Results.NoContent();
    }
}
