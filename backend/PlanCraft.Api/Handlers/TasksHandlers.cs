using Microsoft.EntityFrameworkCore;

namespace PlanCraft.Api.Endpoints;

public static class TasksHandlers
{
    public static Task<List<TaskItem>> GetAll(PlanCraftDb db)
        => db.Tasks.OrderBy(t => t.StartDate).ToListAsync();

    public static async Task<IResult> Create(PlanCraftDb db, TaskItem t)
    {
        t.StartDate = DateTime.SpecifyKind(t.StartDate, DateTimeKind.Utc);
        db.Tasks.Add(t);
        await db.SaveChangesAsync();
        return Results.Created($"/api/tasks/{t.Id}", t);
    }

    public static async Task<IResult> Update(PlanCraftDb db, int id, TaskItem t)
    {
        t.Id = id;
        t.StartDate = DateTime.SpecifyKind(t.StartDate, DateTimeKind.Utc);
        db.Update(t);
        await db.SaveChangesAsync();
        return Results.NoContent();
    }

    public static async Task<IResult> Delete(PlanCraftDb db, int id)
    {
        var t = await db.Tasks.FindAsync(id);
        if (t == null) return Results.NotFound();
        db.Remove(t);
        await db.SaveChangesAsync();
        return Results.NoContent();
    }
}
